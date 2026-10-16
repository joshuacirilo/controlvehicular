import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

Uri apiBaseUrl({
  String value = const String.fromEnvironment('API_BASE_URL'),
  bool release = kReleaseMode,
}) {
  if (release && value.isEmpty) {
    throw StateError(
      'Configura API_BASE_URL con la URL HTTPS de produccion en Vercel.',
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

  Future<String> login(String username, String password) async {
    final response = await _client
        .post(
          baseUrl.resolve('auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'username': username.trim(), 'password': password}),
        )
        .timeout(const Duration(seconds: 10));
    if (response.statusCode == 401) {
      throw const LoginException('Usuario o contrase?a incorrectos.');
    }
    if (response.statusCode == 403) {
      throw const LoginException(
        'El acceso de prueba solo funciona en desarrollo local.',
      );
    }
    if (response.statusCode != 200) {
      throw const LoginException('No se pudo ingresar. Intenta de nuevo.');
    }
    final data = jsonDecode(response.body);
    if (data is! Map ||
        data['mode'] != 'test' ||
        data['user'] is! Map ||
        data['user']['name'] is! String) {
      throw const LoginException('Respuesta del servidor inesperada.');
    }
    return data['user']['name'] as String;
  }

  void close() => _client.close();
}

class LoginException implements Exception {
  const LoginException(this.message);
  final String message;
}
