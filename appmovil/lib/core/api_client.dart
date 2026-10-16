import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'qr_credentials.dart';

Uri apiBaseUrl({
  String value = const String.fromEnvironment('API_BASE_URL'),
  bool release = kReleaseMode,
}) {
  if (release && value.isEmpty) {
    throw StateError(
      'Configura API_BASE_URL con la URL HTTPS de producción en Vercel.',
    );
  }
  final uri = Uri.tryParse(
    value.isEmpty ? 'http://localhost:3000/api/' : value,
  );
  if (uri == null ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      !['http', 'https'].contains(uri.scheme) ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (release &&
          (uri.scheme != 'https' ||
              ['localhost', '127.0.0.1', '::1'].contains(uri.host)))) {
    throw StateError('API_BASE_URL no es una URL valida para este entorno.');
  }
  return uri.replace(path: uri.path.endsWith('/') ? uri.path : '${uri.path}/');
}

class ApiClient {
  ApiClient({http.Client? client, Uri? baseUrl})
    : _client = client ?? http.Client(),
      baseUrl = baseUrl ?? apiBaseUrl();
  final http.Client _client;
  final Uri baseUrl;
  Future<void> checkConnection() async {
    final response = await _client
        .get(baseUrl.resolve('health'))
        .timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) throw StateError('Servicio no disponible');
    final data = jsonDecode(response.body);
    if (data is! Map ||
        data['status'] != 'ok' ||
        data['service'] != 'control-vehicular-api') {
      throw StateError('Respuesta del servidor inesperada');
    }
  }

  /// Signs in the pilot; trips are recorded under this account.
  Future<AuthSession> login(String username, String password) async {
    final response = await _client
        .post(
          baseUrl.resolve('auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'username': username.trim(), 'password': password}),
        )
        .timeout(const Duration(seconds: 15));
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } on FormatException {
      data = null;
    }
    if (response.statusCode == 401) {
      throw const LoginException('Usuario o contraseña incorrectos.');
    }
    if (response.statusCode != 200) {
      throw LoginException(
        data is Map && data['message'] is String
            ? data['message'] as String
            : 'No se pudo ingresar. Intenta de nuevo.',
      );
    }
    if (data is! Map ||
        data['user'] is! Map ||
        data['user']['name'] is! String ||
        data['token'] is! String) {
      throw const LoginException('Respuesta del servidor inesperada.');
    }
    return AuthSession(data['user']['name'] as String, data['token'] as String);
  }

  /// Starts a trip with the scanned truck QR, required for every trip.
  Future<TripInfo> startTrip(
    String token,
    TruckCredentials truck,
    PingSample firstPing,
  ) async {
    final data = await _post('trips/start', token, {
      'placa': truck.plate,
      'password': truck.password,
      'ping': firstPing.toJson(),
    });
    final info = data['truck'];
    if (data['tripId'] is! String || info is! Map || info['placa'] is! String) {
      throw const ApiException('Respuesta del servidor inesperada.');
    }
    return TripInfo(
      id: data['tripId'] as String,
      plate: info['placa'] as String,
      model: info['modelo'] is String ? info['modelo'] as String : '',
    );
  }

  Future<PingResult> sendPings(
    String token,
    String tripId,
    List<PingSample> pings,
  ) async {
    final data = await _post(
      'trips/${Uri.encodeComponent(tripId)}/ping',
      token,
      {
        'pings': [for (final ping in pings) ping.toJson()],
      },
    );
    final accepted = data['accepted'];
    final rejected = data['rejected'];
    if (accepted is! List || rejected is! List) {
      throw const ApiException('Respuesta del servidor inesperada.');
    }
    final latest = data['latest'];
    final speed = latest is Map ? latest['velocidad'] : null;
    return PingResult(
      accepted: {...accepted.whereType<String>()},
      rejected: {
        for (final item in rejected)
          if (item is Map && item['pingId'] is String) item['pingId'] as String,
      },
      speedKmh: speed is num ? speed.toDouble() : null,
      tripActive: data['estado'] == 'activo',
    );
  }

  Future<void> endTrip(String token, String tripId) async {
    final data = await _post(
      'trips/${Uri.encodeComponent(tripId)}/end',
      token,
      const {},
    );
    if (data['estado'] != 'finalizado') {
      throw const ApiException('El servidor no confirmó el cierre del viaje.');
    }
  }

  Future<Map<String, dynamic>> _post(
    String path,
    String token,
    Object body,
  ) async {
    final http.Response response;
    try {
      response = await _client
          .post(
            baseUrl.resolve(path),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
    } on Exception {
      throw const ApiException('No se pudo conectar con el servidor.');
    }
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } on FormatException {
      data = null;
    }
    final ok = response.statusCode >= 200 && response.statusCode < 300;
    if (ok && data is Map<String, dynamic>) return data;
    throw ApiException(
      data is Map && data['message'] is String
          ? data['message'] as String
          : 'Respuesta inesperada del servidor.',
      statusCode: ok ? 502 : response.statusCode,
    );
  }

  void close() => _client.close();
}

class AuthSession {
  const AuthSession(this.name, this.token);
  final String name;
  final String token;
}

class TripInfo {
  const TripInfo({required this.id, required this.plate, required this.model});
  final String id;
  final String plate;
  final String model;
}

/// One device location sample. [id] stays the same across retries so the
/// server can deduplicate it.
class PingSample {
  const PingSample({
    required this.id,
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.timestamp,
  });
  final String id;
  final double latitude;
  final double longitude;
  final double accuracy;
  final DateTime timestamp;

  Map<String, Object> toJson() => {
    'pingId': id,
    'latitude': latitude,
    'longitude': longitude,
    'accuracy': accuracy,
    'timestamp': timestamp.toUtc().toIso8601String(),
  };
}

class PingResult {
  const PingResult({
    required this.accepted,
    required this.rejected,
    required this.speedKmh,
    required this.tripActive,
  });
  final Set<String> accepted;
  final Set<String> rejected;
  final double? speedKmh;
  final bool tripActive;
}

class LoginException implements Exception {
  const LoginException(this.message);
  final String message;
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;

  /// Null when the server could not be reached.
  final int? statusCode;
}
