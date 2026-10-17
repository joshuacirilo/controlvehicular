import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:sqflite_common/sqlite_api.dart';

import 'api_client.dart';
import 'ping_database_io.dart'
    if (dart.library.js_interop) 'ping_database_web.dart';

/// Oldest pending samples of one trip, in the order they were taken.
class PendingBatch {
  const PendingBatch(this.tripId, this.pings);
  final String tripId;
  final List<PingSample> pings;
}

/// Location samples waiting for the server, kept per pilot ([owner]) and trip.
/// A sample stays here until the server acknowledges it.
abstract class PingStore {
  /// False when samples live only in memory and are lost if the app closes.
  bool get persistent;

  Future<void> add(String owner, String tripId, PingSample ping);

  /// Oldest samples of [owner], all from the trip of the oldest one.
  Future<PendingBatch?> next(String owner, int limit);

  Future<int> count(String owner);

  Future<void> remove(Iterable<String> pingIds);

  /// Removes every sample of a trip; returns how many.
  Future<int> removeTrip(String owner, String tripId);

  /// Removes samples of [owner] taken before [limit]; returns how many.
  Future<int> removeOlderThan(String owner, DateTime limit);

  /// Keeps only the newest [max] samples of [owner]; returns how many were removed.
  Future<int> trim(String owner, int max);

  Future<void> close();
}

/// Opens the device database, falling back to memory when it is unavailable.
Future<PingStore> openPingStore() async {
  try {
    return await SqlitePingStore.open(
      pingDatabaseFactory,
      'control_vehicular.db',
    );
  } catch (e) {
    debugPrint('No se pudo abrir la base local de ubicaciones: $e');
    return MemoryPingStore();
  }
}

class SqlitePingStore implements PingStore {
  SqlitePingStore._(this._db);
  final Database _db;

  static const _table = 'pending_pings';
  static const _order = 'taken_at, rowid';

  static Future<SqlitePingStore> open(
    DatabaseFactory factory,
    String path,
  ) async {
    final db = await factory.openDatabase(
      path,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (db, _) async {
          await db.execute('''
            CREATE TABLE $_table (
              ping_id TEXT PRIMARY KEY,
              owner TEXT NOT NULL,
              trip_id TEXT NOT NULL,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              accuracy REAL NOT NULL,
              taken_at INTEGER NOT NULL
            )
          ''');
          await db.execute(
            'CREATE INDEX ${_table}_owner_time ON $_table (owner, taken_at)',
          );
        },
      ),
    );
    return SqlitePingStore._(db);
  }

  @override
  bool get persistent => true;

  @override
  Future<void> add(String owner, String tripId, PingSample ping) =>
      _db.insert(_table, {
        'ping_id': ping.id,
        'owner': owner,
        'trip_id': tripId,
        'latitude': ping.latitude,
        'longitude': ping.longitude,
        'accuracy': ping.accuracy,
        'taken_at': ping.timestamp.millisecondsSinceEpoch,
      }, conflictAlgorithm: ConflictAlgorithm.ignore);

  @override
  Future<PendingBatch?> next(String owner, int limit) async {
    final oldest = await _db.query(
      _table,
      columns: ['trip_id'],
      where: 'owner = ?',
      whereArgs: [owner],
      orderBy: _order,
      limit: 1,
    );
    if (oldest.isEmpty) return null;
    final tripId = oldest.single['trip_id'] as String;
    final rows = await _db.query(
      _table,
      where: 'owner = ? AND trip_id = ?',
      whereArgs: [owner, tripId],
      orderBy: _order,
      limit: limit,
    );
    return PendingBatch(tripId, [
      for (final row in rows)
        PingSample(
          id: row['ping_id'] as String,
          latitude: (row['latitude'] as num).toDouble(),
          longitude: (row['longitude'] as num).toDouble(),
          accuracy: (row['accuracy'] as num).toDouble(),
          timestamp: DateTime.fromMillisecondsSinceEpoch(
            row['taken_at'] as int,
            isUtc: true,
          ),
        ),
    ]);
  }

  @override
  Future<int> count(String owner) async {
    final rows = await _db.rawQuery(
      'SELECT COUNT(*) AS n FROM $_table WHERE owner = ?',
      [owner],
    );
    return rows.single['n'] as int;
  }

  @override
  Future<void> remove(Iterable<String> pingIds) async {
    final ids = pingIds.toList();
    // SQLite caps the number of bound parameters per statement.
    for (var i = 0; i < ids.length; i += 500) {
      final chunk = ids.sublist(i, min(i + 500, ids.length));
      await _db.delete(
        _table,
        where: 'ping_id IN (${List.filled(chunk.length, '?').join(',')})',
        whereArgs: chunk,
      );
    }
  }

  @override
  Future<int> removeTrip(String owner, String tripId) => _db.delete(
    _table,
    where: 'owner = ? AND trip_id = ?',
    whereArgs: [owner, tripId],
  );

  @override
  Future<int> removeOlderThan(String owner, DateTime limit) => _db.delete(
    _table,
    where: 'owner = ? AND taken_at < ?',
    whereArgs: [owner, limit.millisecondsSinceEpoch],
  );

  @override
  Future<int> trim(String owner, int max) => _db.rawDelete(
    'DELETE FROM $_table WHERE rowid IN ('
    'SELECT rowid FROM $_table WHERE owner = ? '
    'ORDER BY taken_at DESC, rowid DESC LIMIT -1 OFFSET ?)',
    [owner, max],
  );

  @override
  Future<void> close() => _db.close();
}

/// Queue kept in memory: used by tests and when the device has no storage.
class MemoryPingStore implements PingStore {
  final _rows = <({int seq, String owner, String tripId, PingSample ping})>[];
  var _seq = 0;

  @override
  bool get persistent => false;

  List<({int seq, String owner, String tripId, PingSample ping})> _of(
    String owner,
  ) => _rows.where((r) => r.owner == owner).toList()
    ..sort(
      (a, b) => a.ping.timestamp != b.ping.timestamp
          ? a.ping.timestamp.compareTo(b.ping.timestamp)
          : a.seq.compareTo(b.seq),
    );

  int _removeWhere(bool Function(PingSample ping) test, String owner) {
    final before = _rows.length;
    _rows.removeWhere((r) => r.owner == owner && test(r.ping));
    return before - _rows.length;
  }

  @override
  Future<void> add(String owner, String tripId, PingSample ping) async {
    if (_rows.any((r) => r.ping.id == ping.id)) return;
    _rows.add((seq: _seq++, owner: owner, tripId: tripId, ping: ping));
  }

  @override
  Future<PendingBatch?> next(String owner, int limit) async {
    final mine = _of(owner);
    if (mine.isEmpty) return null;
    final tripId = mine.first.tripId;
    return PendingBatch(tripId, [
      for (final r in mine.where((r) => r.tripId == tripId).take(limit)) r.ping,
    ]);
  }

  @override
  Future<int> count(String owner) async =>
      _rows.where((r) => r.owner == owner).length;

  @override
  Future<void> remove(Iterable<String> pingIds) async {
    final ids = pingIds.toSet();
    _rows.removeWhere((r) => ids.contains(r.ping.id));
  }

  @override
  Future<int> removeTrip(String owner, String tripId) async {
    final before = _rows.length;
    _rows.removeWhere((r) => r.owner == owner && r.tripId == tripId);
    return before - _rows.length;
  }

  @override
  Future<int> removeOlderThan(String owner, DateTime limit) async =>
      _removeWhere((p) => p.timestamp.isBefore(limit), owner);

  @override
  Future<int> trim(String owner, int max) async {
    final mine = _of(owner);
    if (mine.length <= max) return 0;
    final drop = {for (final r in mine.take(mine.length - max)) r.ping.id};
    return _removeWhere((p) => drop.contains(p.id), owner);
  }

  @override
  Future<void> close() async {}
}
