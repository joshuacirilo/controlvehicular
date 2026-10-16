import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:control_vehicular/core/api_client.dart';
import 'package:control_vehicular/core/qr_credentials.dart';
import 'package:control_vehicular/login_page.dart';

void main() {
  test('QR accepts JSON or labeled credentials and rejects URLs or malformed payloads', () {
    final valid = QrCredentials.parse(
      '{"username":" prueba1 ","password":"123"}',
    );
    expect(valid.username, 'prueba1');
    expect(valid.password, '123');
    for (final labeled in [
      'Usuario: prueba1\nContraseña: 123',
      'usuario=prueba1\r\ncontrasena=123\n',
      'Username: prueba1\nPassword: 123',
    ]) {
      expect(
        () => TruckCredentials.parse(labeled),
        throwsFormatException,
        reason: 'login QR must not start a trip',
      );
      final parsed = QrCredentials.parse(labeled);
      expect(parsed.username, 'prueba1');
      expect(parsed.password, '123');
    }
    for (final invalid in [
      'https://example.com',
      '{',
      '[]',
      '{}',
      '{"username":"prueba1","password":123}',
      '{"username":"","password":"123"}',
      '{"username":"prueba1","password":""}',
      'Usuario: prueba1',
      'Usuario: prueba1\nContraseña:',
      'Usuario: prueba1\nContraseña: 123\nUsuario: otro',
      'Usuario: prueba1\nContraseña: 123\nUrl: https://example.com',
      'prueba1 123',
      'x' * 2049,
    ]) {
      expect(() => QrCredentials.parse(invalid), throwsFormatException);
    }
  });
  test('Truck QR needs plate and password and rejects login QRs', () {
    for (final raw in [
      'Placa: prueba123\nContraseña: camion123!',
      'placa:prueba123 contraseña: camion123!',
      'CONTRASEÑA=camion123! PLACA: prueba123',
      '{"placa":" PRUEBA123 ","password":"camion123!"}',
    ]) {
      final truck = TruckCredentials.parse(raw);
      expect(truck.plate, 'PRUEBA123');
      expect(truck.password, 'camion123!');
      expect(() => QrCredentials.parse(raw), throwsFormatException);
    }
    for (final invalid in [
      'PRUEBA123',
      'TRUCK-DEMO-001',
      'Placa: PRUEBA123',
      'Placa: PRUEBA 123\nContraseña: x',
      'Placa: ${'A' * 21}\nContraseña: x',
      'Placa: PRUEBA123\nContraseña:',
      'Placa: PRUEBA123 Contraseña:',
      'Usuario: piloto1 Contraseña: x',
      'Hola Placa: PRUEBA123 Contraseña: x',
      '{"placa":"PRUEBA123"}',
      'https://example.com',
    ]) {
      expect(() => TruckCredentials.parse(invalid), throwsFormatException);
    }
  });
  testWidgets('Login shows the server reason when it is refused', (
    tester,
  ) async {
    final api = ApiClient(
      client: MockClient(
        (_) async => http.Response(
          '{"message":"Tu usuario no está vinculado a un conductor activo."}',
          403,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      ),
    );
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(
        home: LoginPage(
          api: api,
          scanQr: (_) async => const QrCredentials('piloto1', 'clave-123'),
        ),
      ),
    );
    await tester.ensureVisible(find.text('Ingresar con QR'));
    await tester.tap(find.text('Ingresar con QR'));
    await tester.pumpAndSettle();
    expect(
      find.text('Tu usuario no está vinculado a un conductor activo.'),
      findsOneWidget,
    );
  });
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
                  '{"mode":"usuario","user":{"name":"Usuario de prueba"},"token":"t"}',
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
                QrCredentials.parse('Usuario: prueba1\nContraseña: 123'),
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
