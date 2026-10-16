import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:control_vehicular/core/api_client.dart';
import 'package:control_vehicular/core/qr_credentials.dart';
import 'package:control_vehicular/login_page.dart';

void main() {
  test(
    'QR requires text credentials and rejects URLs or malformed payloads',
    () {
      final valid = QrCredentials.parse(
        '{"username":" prueba1 ","password":"123"}',
      );
      expect(valid.username, 'prueba1');
      expect(valid.password, '123');
      for (final invalid in [
        'https://example.com',
        '{',
        '[]',
        '{}',
        '{"username":"prueba1","password":123}',
        '{"username":"","password":"123"}',
        '{"username":"prueba1","password":""}',
        'x' * 2049,
      ]) {
        expect(() => QrCredentials.parse(invalid), throwsFormatException);
      }
    },
  );
  for (final accepted in [true, false]) {
    testWidgets('QR login waits for backend approval: $accepted', (
      tester,
    ) async {
      var requests = 0;
      final api = ApiClient(
        client: MockClient((request) async {
          requests++;
          expect(request.url.path, '/api/auth/login');
          expect(jsonDecode(request.body), {
            'username': 'prueba1',
            'password': '123',
          });
          return accepted
              ? http.Response(
                  '{"mode":"test","user":{"name":"Usuario de prueba"}}',
                  200,
                )
              : http.Response('{}', 401);
        }),
      );
      addTearDown(api.close);
      await tester.pumpWidget(
        MaterialApp(
          home: LoginPage(
            api: api,
            scanQr: (_) async =>
                QrCredentials.parse('{"username":"prueba1","password":"123"}'),
          ),
        ),
      );
      await tester.ensureVisible(find.text('Ingresar con QR'));
      await tester.tap(find.text('Ingresar con QR'));
      await tester.pumpAndSettle();
      expect(requests, 1);
      expect(
        find.text('Hola, Usuario de prueba'),
        accepted ? findsOneWidget : findsNothing,
      );
      if (!accepted) {
        expect(find.text('Usuario o contraseña incorrectos.'), findsOneWidget);
      }
    });
  }
  testWidgets('Cancelling QR does not send credentials', (tester) async {
    final api = ApiClient(
      client: MockClient((_) async {
        fail('Unexpected HTTP call');
      }),
    );
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(
        home: LoginPage(api: api, scanQr: (_) async => null),
      ),
    );
    await tester.ensureVisible(find.text('Ingresar con QR'));
    await tester.tap(find.text('Ingresar con QR'));
    await tester.pumpAndSettle();
    expect(find.text('Bienvenido'), findsOneWidget);
  });
}
