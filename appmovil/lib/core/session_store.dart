import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

/// Keeps the pilot's session and active trip across app restarts, so only an
/// explicit logout signs the pilot out.
abstract interface class SessionStore {
  Future<AuthSession?> read();
  Future<void> save(AuthSession session);
  Future<TripInfo?> readTrip();
  Future<void> saveTrip(TripInfo trip);
  Future<void> clearTrip();

  /// Forgets the session and its trip.
  Future<void> clear();
}

/// Encrypted storage of the platform (Android Keystore, WebCrypto on web).
class SecureSessionStore implements SessionStore {
  SecureSessionStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;

  static const _sessionKey = 'session';
  static const _tripKey = 'active_trip';

  @override
  Future<AuthSession?> read() async {
    final data = await _readJson(_sessionKey);
    if (data == null ||
        data['userId'] is! String ||
        data['name'] is! String ||
        data['token'] is! String) {
      return null;
    }
    return AuthSession(
      data['userId'] as String,
      data['name'] as String,
      data['token'] as String,
    );
  }

  @override
  Future<void> save(AuthSession session) => _storage.write(
    key: _sessionKey,
    value: jsonEncode({
      'userId': session.userId,
      'name': session.name,
      'token': session.token,
    }),
  );

  @override
  Future<TripInfo?> readTrip() async {
    final data = await _readJson(_tripKey);
    if (data == null || data['id'] is! String || data['plate'] is! String) {
      return null;
    }
    return TripInfo(
      id: data['id'] as String,
      plate: data['plate'] as String,
      model: data['model'] is String ? data['model'] as String : '',
      startedAt: data['startedAt'] is String
          ? DateTime.tryParse(data['startedAt'] as String)
          : null,
    );
  }

  @override
  Future<void> saveTrip(TripInfo trip) => _storage.write(
    key: _tripKey,
    value: jsonEncode({
      'id': trip.id,
      'plate': trip.plate,
      'model': trip.model,
      'startedAt': trip.startedAt?.toUtc().toIso8601String(),
    }),
  );

  @override
  Future<void> clearTrip() => _storage.delete(key: _tripKey);

  @override
  Future<void> clear() async {
    await _storage.delete(key: _tripKey);
    await _storage.delete(key: _sessionKey);
  }

  Future<Map<String, dynamic>?> _readJson(String key) async {
    try {
      final raw = await _storage.read(key: key);
      final data = raw == null ? null : jsonDecode(raw);
      return data is Map<String, dynamic> ? data : null;
    } catch (_) {
      // Unreadable data (e.g. keys lost after a device restore) means no session.
      return null;
    }
  }
}

/// In-memory store for tests.
class MemorySessionStore implements SessionStore {
  MemorySessionStore({this.session, this.trip});
  AuthSession? session;
  TripInfo? trip;

  @override
  Future<AuthSession?> read() async => session;

  @override
  Future<void> save(AuthSession session) async => this.session = session;

  @override
  Future<TripInfo?> readTrip() async => trip;

  @override
  Future<void> saveTrip(TripInfo trip) async => this.trip = trip;

  @override
  Future<void> clearTrip() async => trip = null;

  @override
  Future<void> clear() async {
    session = null;
    trip = null;
  }
}
