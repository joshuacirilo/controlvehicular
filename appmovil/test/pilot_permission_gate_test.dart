import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:control_vehicular/pilot_permission_gate.dart';

void main() {
  testWidgets('denied access stays blocked until every permission is active', (
    tester,
  ) async {
    var ready = 0;
    var missing = [
      'Permitir ubicación precisa.',
      'Permitir la cámara para escanear QR.',
    ];
    await tester.pumpWidget(
      MaterialApp(
        home: PilotPermissionGate(
          check: (_) async => missing,
          onReady: () async {
            ready++;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(ready, 0);
    expect(find.text('Permitir ubicación precisa.'), findsOneWidget);
    missing = ['Permitir la cámara para escanear QR.'];
    await tester.tap(find.text('Verificar permisos'));
    await tester.pumpAndSettle();
    expect(ready, 0);
    missing = [];
    await tester.tap(find.text('Verificar permisos'));
    await tester.pumpAndSettle();
    expect(ready, 1);
  });
  testWidgets('permission check failure never grants access', (tester) async {
    var ready = false;
    await tester.pumpWidget(
      MaterialApp(
        home: PilotPermissionGate(
          check: (_) async => throw StateError('unavailable'),
          onReady: () async {
            ready = true;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(ready, isFalse);
    expect(find.textContaining('No se pudieron verificar'), findsOneWidget);
  });
}
