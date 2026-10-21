import 'package:control_vehicular/core/api_client.dart';

import 'dart:io';

import 'package:control_vehicular/core/ping_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

final _base = DateTime.utc(2026, 10, 16, 20);

PingSample _ping(String id, int second) => PingSample(
  id: id,
  latitude: 14.6349,
  longitude: -90.5069,
  accuracy: 12.5,
  timestamp: _base.add(Duration(seconds: second)),
);

void main() {
  sqfliteFfiInit();
  test(
    'upgrades the existing queue without losing pending locations',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'cv-gps-migration-',
      );
      final path = '${directory.path}/queue.db';
      final legacy = await databaseFactoryFfi.openDatabase(
        path,
        options: OpenDatabaseOptions(
          version: 1,
          onCreate: (db, _) async {
            await db.execute(
              'CREATE TABLE pending_pings (ping_id TEXT PRIMARY KEY, owner TEXT NOT NULL, trip_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL NOT NULL, taken_at INTEGER NOT NULL)',
            );
          },
        ),
      );
      await legacy.insert('pending_pings', {
        'ping_id': 'old',
        'owner': 'u1',
        'trip_id': 'trip-a',
        'latitude': 14.6,
        'longitude': -90.5,
        'accuracy': 10,
        'taken_at': _base.millisecondsSinceEpoch,
      });
      await legacy.close();
      final store = await SqlitePingStore.open(databaseFactoryFfi, path);
      try {
        final restored = (await store.next('u1', 50))!.pings.single;
        expect(restored.id, 'old');
        expect(restored.qualityFlags, isEmpty);
        expect(restored.latitude, 14.6);
      } finally {
        await store.close();
        await directory.delete(recursive: true);
      }
    },
  );
  final stores = <String, Future<PingStore> Function()>{
    'memoria': () async => MemoryPingStore(),
    'SQLite': () =>
        SqlitePingStore.open(databaseFactoryFfi, inMemoryDatabasePath),
  };

  for (final MapEntry(key: name, value: open) in stores.entries) {
    group(name, () {
      late PingStore store;
      setUp(() async => store = await open());
      tearDown(() => store.close());
      test(
        'preserves quality flags and original coordinates for retries',
        () async {
          final sample = PingSample(
            id: 'flagged',
            latitude: 14.6,
            longitude: -90.5,
            accuracy: 500,
            timestamp: _base,
            qualityFlags: ['low_accuracy', 'stale'],
          );
          await store.add('u1', 'trip-a', sample);
          final restored = (await store.next('u1', 50))!.pings.single;
          expect(restored.qualityFlags, sample.qualityFlags);
          expect(restored.toJson(), sample.toJson());
        },
      );

      test(
        'returns the oldest trip first, in the order samples were taken',
        () async {
          await store.add('u1', 'trip-b', _ping('b-late', 30));
          await store.add('u1', 'trip-a', _ping('a-2', 20));
          await store.add('u1', 'trip-a', _ping('a-1', 10));
          await store.add('u2', 'trip-z', _ping('z-1', 0));

          final batch = (await store.next('u1', 50))!;
          expect(batch.tripId, 'trip-a');
          expect([for (final p in batch.pings) p.id], ['a-1', 'a-2']);
          final first = batch.pings.first;
          expect(first.latitude, 14.6349);
          expect(first.longitude, -90.5069);
          expect(first.accuracy, 12.5);
          expect(first.timestamp, _base.add(const Duration(seconds: 10)));
          expect(first.timestamp.isUtc, isTrue);

          await store.remove(['a-1', 'a-2']);
          expect((await store.next('u1', 50))!.tripId, 'trip-b');
          expect(await store.count('u1'), 1);
          expect(await store.count('u2'), 1);
        },
      );

      test(
        'ignores a sample stored twice and honours the batch limit',
        () async {
          for (var i = 0; i < 5; i++) {
            await store.add('u1', 'trip-a', _ping('p$i', i));
          }
          await store.add('u1', 'trip-a', _ping('p0', 0));
          expect(await store.count('u1'), 5);
          expect((await store.next('u1', 3))!.pings, hasLength(3));
          expect(await store.next('nobody', 3), isNull);
        },
      );

      test(
        'removes a trip, old samples and the oldest beyond the limit',
        () async {
          for (var i = 0; i < 6; i++) {
            await store.add('u1', 'trip-a', _ping('a$i', i));
          }
          await store.add('u1', 'trip-b', _ping('b0', 100));
          await store.add('u2', 'trip-a', _ping('other', 0));

          expect(
            await store.removeOlderThan(
              'u1',
              _base.add(const Duration(seconds: 2)),
            ),
            2,
          );
          expect(await store.trim('u1', 3), 2);
          final left = (await store.next('u1', 50))!;
          expect([for (final p in left.pings) p.id], ['a4', 'a5']);
          expect(await store.removeTrip('u1', 'trip-a'), 2);
          expect(await store.count('u1'), 1);
          expect(await store.count('u2'), 1);
        },
      );
    });
  }
}
