import 'dart:convert';

import 'package:control_vehicular/login_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:control_vehicular/core/api_client.dart';
import 'package:control_vehicular/core/ping_store.dart';
import 'package:control_vehicular/main.dart';

void main() {
  testWidgets('Login rejects invalid credentials then succeeds and resets', (
    tester,
  ) async {
    final api = ApiClient(
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/api/auth/login');
        final body = jsonDecode(request.body);
        if (body['password'] != '123') return http.Response('{}', 401);
        expect(body['username'], 'prueba1');
        return http.Response(
          '{"mode":"usuario","user":{"id":"u1","name":"Usuario de prueba"},"token":"t"}',
          200,
        );
      }),
    );
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(
        home: LoginPage(api: api, store: MemoryPingStore()),
      ),
    );
    await tester.enterText(find.byType(TextFormField).at(0), 'prueba1');
    await tester.enterText(find.byType(TextFormField).at(1), 'incorrecta');
    await tester.ensureVisible(find.text('Ingresar'));
    await tester.tap(find.text('Ingresar'));
    await tester.pumpAndSettle();
    expect(find.text('Usuario o contraseña incorrectos.'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(1), '123');
    await tester.ensureVisible(find.text('Ingresar'));
    await tester.tap(find.text('Ingresar'));
    await tester.pumpAndSettle();
    expect(find.text('Hola, Usuario de prueba'), findsOneWidget);
    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();
    expect(find.text('Ingresar'), findsOneWidget);
  });
  test('Release requires HTTPS production configuration', () {
    for (final url in [
      '',
      'http://localhost:3000/api/',
      'https://localhost/api/',
    ]) {
      expect(() => apiBaseUrl(value: url, release: true), throwsStateError);
    }
    expect(
      apiBaseUrl(
        value: 'https://example.vercel.app/api',
        release: true,
      ).resolve('health').path,
      '/api/health',
    );
  });
  test('Rejects unrelated or failed HTTP responses', () async {
    for (final response in [
      http.Response('{}', 200),
      http.Response('unavailable', 503),
    ]) {
      final api = ApiClient(client: MockClient((_) async => response));
      addTearDown(api.close);
      await expectLater(api.checkConnection(), throwsStateError);
    }
  });
  testWidgets('Connection failure can recover with retry', (tester) async {
    var attempts = 0;
    final api = ApiClient(
      client: MockClient((request) async {
        expect(request.url.toString(), 'http://localhost:3000/api/health');
        attempts++;
        if (attempts == 1) throw http.ClientException('offline');
        return http.Response(
          '{"status":"ok","service":"control-vehicular-api"}',
          200,
        );
      }),
    );
    addTearDown(api.close);
    await tester.pumpWidget(MaterialApp(home: ConnectionPage(api: api)));
    await tester.pumpAndSettle();
    expect(find.textContaining('No se pudo conectar'), findsOneWidget);
    await tester.tap(find.text('Comprobar conexión'));
    await tester.pumpAndSettle();
    expect(find.text('Conexión con el servidor establecida'), findsOneWidget);
  });
}
