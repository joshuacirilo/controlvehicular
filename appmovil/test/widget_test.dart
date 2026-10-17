import 'dart:convert';

import 'package:control_vehicular/login_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:control_vehicular/core/api_client.dart';
import 'package:control_vehicular/core/ping_store.dart';
import 'package:control_vehicular/core/session_store.dart';
import 'package:control_vehicular/main.dart';

void main() {
  testWidgets('Login is saved and only a confirmed logout clears it', (
    tester,
  ) async {
    var loggedOut = 0;
    final api = ApiClient(
      client: MockClient((request) async {
        if (request.url.path == '/api/trips/active') {
          expect(request.headers['Authorization'], 'Bearer token-1');
          return http.Response('{"trip":null}', 200);
        }
        if (request.url.path == '/api/auth/logout') {
          expect(request.headers['Authorization'], 'Bearer token-1');
          loggedOut++;
          return http.Response('{"loggedOut":true}', 200);
        }
        expect(request.method, 'POST');
        expect(request.url.path, '/api/auth/login');
        final body = jsonDecode(request.body);
        if (body['password'] != '123') return http.Response('{}', 401);
        expect(body['username'], 'prueba1');
        return http.Response(
          '{"user":{"id":"u1","name":"Usuario de prueba"},"token":"token-1"}',
          200,
        );
      }),
    );
    addTearDown(api.close);
    final sessions = MemorySessionStore();
    await tester.pumpWidget(
      MaterialApp(
        home: LoginPage(
          api: api,
          store: MemoryPingStore(),
          sessionStore: sessions,
        ),
      ),
    );
    await tester.pumpAndSettle();
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
    expect(sessions.session?.token, 'token-1');

    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(find.text('Hola, Usuario de prueba'), findsOneWidget);
    expect(sessions.session, isNotNull);

    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Cerrar sesión'));
    await tester.pumpAndSettle();
    expect(find.text('Ingresar'), findsOneWidget);
    expect(sessions.session, isNull);
    expect(loggedOut, 1);
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
