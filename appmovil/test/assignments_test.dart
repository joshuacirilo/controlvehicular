import 'dart:async';
import 'dart:convert';

import 'package:control_vehicular/core/api_client.dart';
import 'package:control_vehicular/core/assignments.dart';
import 'package:control_vehicular/core/qr_credentials.dart';
import 'package:control_vehicular/core/trip_tracker.dart';
import 'package:control_vehicular/trip_home_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _json = {'content-type': 'application/json; charset=utf-8'};

Map<String, Object?> _assignment({
  String id = 'a1',
  bool delivered = false,
  bool read = false,
  String estado = 'pendiente',
}) => {
  'id': id,
  'truck': {'placa': 'P123ABC', 'modelo': 'Hino'},
  'origen': {'lat': 14.6349, 'lng': -90.5069, 'nombre': 'Bodega'},
  'destino': {'lat': 14.5586, 'lng': -90.7295, 'nombre': 'Antigua'},
  'programadoPara': '2026-10-24T14:00:00.000Z',
  'nota': 'Llevar documentos',
  'estado': estado,
  'entregada': delivered,
  'leida': read,
};

class _Server {
  _Server(this.items);
  final List<Map<String, Object?>> items;
  final marks = <String>[];
  late final api = ApiClient(client: MockClient(_handle));

  Future<http.Response> _handle(http.Request request) async {
    final path = request.url.path;
    http.Response reply(Object body, [int status = 200]) =>
        http.Response(jsonEncode(body), status, headers: _json);
    if (path == '/api/assignments/mine') return reply({'assignments': items});
    final mark = RegExp(r'^/api/assignments/(\w+)/(delivered|read)$')
        .firstMatch(path);
    if (mark != null) {
      marks.add('${mark[1]}/${mark[2]}');
      final item = items.firstWhere((a) => a['id'] == mark[1]);
      item['entregada'] = true;
      if (mark[2] == 'read') item['leida'] = true;
      return reply({'id': mark[1], 'entregada': true, 'leida': item['leida']});
    }
    if (path == '/api/trips/start') {
      items.first['estado'] = 'en_curso';
      return reply({
        'tripId': 'trip-1',
        'truck': {'placa': 'P123ABC', 'modelo': 'Hino'},
        'assignment': items.first,
      }, 201);
    }
    if (path == '/api/trips/trip-1/ping') {
      final ids = [
        for (final p in (jsonDecode(request.body) as Map)['pings'] as List)
          (p as Map)['pingId'],
      ];
      return reply({'estado': 'activo', 'accepted': ids, 'rejected': []});
    }
    return reply({'message': 'Unexpected $path'}, 500);
  }
}

Future<Position> _locate() async => Position(
  latitude: 14.6349,
  longitude: -90.5069,
  timestamp: DateTime.now(),
  accuracy: 5,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
);

void main() {
  test('malformed assignments are ignored', () async {
    final server = _Server([
      _assignment(),
      {'id': 'broken', 'truck': {}},
    ]);
    final items = await server.api.assignments('token-1');
    expect(items.map((a) => a.id), ['a1']);
    expect(items.single.origin.label, 'Bodega');
    expect(items.single.destination.coordinates, '14.55860, -90.72950');
    expect(items.single.scheduledAt, DateTime.utc(2026, 10, 24, 14));
  });

  testWidgets('new assignments notify once and are reported as delivered', (
    tester,
  ) async {
    final server = _Server([
      _assignment(),
      _assignment(id: 'a2', delivered: true),
    ]);
    final notified = <String>[];
    final watcher = AssignmentWatcher(
      api: server.api,
      token: 'token-1',
      notify: (a) async => notified.add(a.id),
    );
    await tester.pump();
    expect(notified, ['a1']);
    expect(server.marks, ['a1/delivered']);
    expect(watcher.assignments.first.delivered, isTrue);
    expect(watcher.unreadCount, 2);

    unawaited(watcher.refresh());
    await tester.pump();
    expect(notified, ['a1']);
    expect(server.marks, ['a1/delivered']);

    unawaited(watcher.markRead(watcher.assignments.first));
    await tester.pump();
    expect(server.marks, ['a1/delivered', 'a1/read']);
    expect(watcher.unreadCount, 1);
    watcher.dispose();
  });

  testWidgets(
    'home shows the assignment, opening it marks it read and the trip links it',
    (tester) async {
      tester.view.physicalSize = const Size(800, 1800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final server = _Server([_assignment()]);
      final watcher = AssignmentWatcher(
        api: server.api,
        token: 'token-1',
        notify: (_) async {},
      );
      final tracker = TripTracker(
        api: server.api,
        token: 'token-1',
        userId: 'u1',
        locate: _locate,
        uploadInterval: const Duration(seconds: 5),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: TripHomePage(
            name: 'Piloto',
            tracker: tracker,
            onLogout: () {},
            assignments: watcher,
            scanTruckQr: (_) async =>
                const TruckCredentials('P123ABC', 'camion123!'),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Viaje asignado'), findsOneWidget);
      expect(find.text('Bodega → Antigua'), findsOneWidget);
      expect(find.byTooltip('Notificaciones (1 sin leer)'), findsOneWidget);

      await tester.tap(find.text('Ver detalles'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Viaje asignado · P123ABC'));
      await tester.pumpAndSettle();
      expect(find.text('Destino (B)'), findsOneWidget);
      expect(find.text('Llevar documentos'), findsOneWidget);
      expect(server.marks, contains('a1/read'));
      Navigator.of(tester.element(find.text('Destino (B)'))).pop();
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byTooltip('Notificaciones'), findsOneWidget);

      await tester.tap(find.text('Iniciar viaje'));
      await tester.pump(const Duration(milliseconds: 10));
      await tester.pump();
      expect(tracker.status, TripStatus.active);
      expect(tracker.trip?.assignment?.id, 'a1');
      expect(find.text('Viaje asignado: Bodega → Antigua'), findsOneWidget);
      expect(find.text('Ver detalles'), findsNothing);

      await tester.pumpWidget(const SizedBox());
      tracker.dispose();
      watcher.dispose();
    },
  );
}
