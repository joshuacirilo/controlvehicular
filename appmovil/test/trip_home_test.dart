import 'dart:async';
import 'dart:convert';

import 'package:control_vehicular/core/api_client.dart';
import 'package:control_vehicular/core/ping_store.dart';
import 'package:control_vehicular/core/qr_credentials.dart';
import 'package:control_vehicular/core/trip_tracker.dart';
import 'package:control_vehicular/trip_home_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _json = {'content-type': 'application/json; charset=utf-8'};

class _FakeServer {
  final requests = <http.Request>[];
  int failingPings = 0;
  bool sessionExpired = false;
  String busyPlate = 'BUSY';

  late final api = ApiClient(client: MockClient(_handle));

  Iterable<http.Request> get pings =>
      requests.where((r) => r.url.path.endsWith('/ping'));
  Iterable<http.Request> get ends =>
      requests.where((r) => r.url.path.endsWith('/end'));
  List<String> pingIds(http.Request r) => [
    for (final p in (jsonDecode(r.body) as Map)['pings'] as List)
      (p as Map)['pingId'] as String,
  ];

  Future<http.Response> _handle(http.Request request) async {
    requests.add(request);
    expectSync(request.headers['Authorization'], 'Bearer token-1');
    final body = jsonDecode(request.body) as Map;
    final path = request.url.path;
    if (path == '/api/trips/start') {
      if (body['placa'] == busyPlate) {
        return http.Response(
          '{"message":"Este camión ya tiene un viaje activo."}',
          409,
          headers: _json,
        );
      }
      return http.Response(
        '{"tripId":"trip-1","truck":{"placa":"PRUEBA123","modelo":"Hino 500"}}',
        201,
        headers: _json,
      );
    }
    if (path == '/api/trips/trip-1/ping') {
      if (sessionExpired) {
        return http.Response(
          '{"message":"Sesión vencida."}',
          401,
          headers: _json,
        );
      }
      if (failingPings > 0) {
        failingPings--;
        return http.Response(
          '{"message":"No disponible."}',
          503,
          headers: _json,
        );
      }
      final ids = [for (final p in body['pings'] as List) (p as Map)['pingId']];
      return http.Response(
        jsonEncode({
          'estado': 'activo',
          'accepted': ids,
          'rejected': [],
          'latest': {'velocidad': 42.0},
        }),
        200,
        headers: _json,
      );
    }
    if (path == '/api/trips/trip-1/end') {
      return http.Response('{"estado":"finalizado"}', 200, headers: _json);
    }
    fail('Unexpected request $path');
  }
}

var _fix = 0;
Future<Position> _locate() async {
  _fix++;
  return _positionAt(DateTime.now());
}

Position _positionAt(DateTime timestamp) {
  return Position(
    latitude: 14.6349 + _fix * 0.0005,
    longitude: -90.5069,
    timestamp: timestamp,
    accuracy: 5,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}

const _truckQr = TruckCredentials('PRUEBA123', 'camion123!');

Future<(_FakeServer, TripTracker)> _pumpTrip(
  WidgetTester tester, {
  TruckCredentials? qr = _truckQr,
  VoidCallback? onLogout,
  PingStore? store,
  Stream<Position> Function()? watch,
}) async {
  tester.view.physicalSize = const Size(800, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final server = _FakeServer();
  final tracker = TripTracker(
    api: server.api,
    token: 'token-1',
    userId: 'user-1',
    store: store,
    locate: _locate,
    watch: watch,
  );
  await tester.pumpWidget(
    MaterialApp(
      home: TripHomePage(
        name: 'Conductor',
        tracker: tracker,
        onLogout: onLogout ?? () {},
        scanTruckQr: (_) async => qr,
      ),
    ),
  );
  await tester.tap(find.text('Iniciar viaje'));
  await tester.pump(const Duration(milliseconds: 10));
  return (server, tracker);
}

/// The periodic tracking timer must be gone before the test body returns.
Future<void> _finish(WidgetTester tester, TripTracker tracker) async {
  await tester.pumpWidget(const SizedBox());
  tracker.dispose();
}

const _tick = Duration(seconds: 5);

void main() {
  testWidgets('Starts with the truck QR and sends a ping every 5 seconds', (
    tester,
  ) async {
    final (server, tracker) = await _pumpTrip(tester);
    final start = jsonDecode(server.requests.single.body) as Map;
    expect(start['placa'], 'PRUEBA123');
    expect(start['password'], 'camion123!');
    expect((start['ping'] as Map)['pingId'], hasLength(32));
    expect(find.text('PRUEBA123 · Hino 500'), findsOneWidget);
    expect(find.text('Viaje en curso'), findsOneWidget);

    await tester.pump(_tick);
    expect(server.pings, hasLength(1));
    await tester.pump(_tick);
    expect(server.pings, hasLength(2));
    expect(
      find.text('Velocidad (calculada por el servidor): 42 km/h'),
      findsOneWidget,
    );
    expect(find.textContaining('Enviadas: 3 · Pendientes: 0'), findsOneWidget);

    await tester.tap(find.text('Terminar viaje'));
    await tester.pump(const Duration(milliseconds: 10));
    expect(server.ends, hasLength(1));
    expect(tracker.status, TripStatus.idle);
    final requests = server.requests.length;
    await tester.pump(_tick * 3);
    expect(server.requests, hasLength(requests));
    await _finish(tester, tracker);
  });

  testWidgets('Background stream feeds the samples and stops with the trip', (
    tester,
  ) async {
    final positions = StreamController<Position>.broadcast();
    addTearDown(positions.close);
    final (server, tracker) = await _pumpTrip(
      tester,
      watch: () => positions.stream,
    );
    expect(positions.hasListener, isTrue);
    expect(find.textContaining('No cierres la app'), findsOneWidget);
    final fixes = _fix;

    final base = DateTime.now();
    positions
      ..add(_positionAt(base.add(_tick)))
      ..add(_positionAt(base.add(_tick + const Duration(seconds: 1))));
    await tester.pump(_tick);
    expect(server.pingIds(server.pings.single), hasLength(1));
    positions.add(_positionAt(base.add(_tick * 2)));
    await tester.pump(_tick);
    expect(server.pings, hasLength(2));
    expect(_fix, fixes);

    await tester.tap(find.text('Terminar viaje'));
    await tester.pump(const Duration(milliseconds: 10));
    expect(server.ends, hasLength(1));
    expect(positions.hasListener, isFalse);
    await _finish(tester, tracker);
  });

  testWidgets('Failed pings stay queued and retry with the same ids', (
    tester,
  ) async {
    final (server, tracker) = await _pumpTrip(tester);
    server.failingPings = 1;
    await tester.pump(_tick);
    expect(find.text('Sin conexión · reintentando'), findsOneWidget);
    expect(find.textContaining('Pendientes: 1'), findsOneWidget);
    final failedId = server.pingIds(server.pings.single).single;

    await tester.pump(_tick);
    final retry = server.pingIds(server.pings.last);
    expect(retry, hasLength(2));
    expect(retry.first, failedId);
    expect(find.text('Conectado'), findsOneWidget);
    expect(find.textContaining('Pendientes: 0'), findsOneWidget);
    await _finish(tester, tracker);
  });

  testWidgets('Samples taken offline survive a restart and are sent later', (
    tester,
  ) async {
    final store = MemoryPingStore();
    final (server, tracker) = await _pumpTrip(tester, store: store);
    server.failingPings = 100;
    await tester.pump(_tick);
    await tester.pump(_tick);
    expect(tracker.pendingCount, 2);
    final offline = {for (final r in server.pings) ...server.pingIds(r)};
    expect(offline, hasLength(2));
    await _finish(tester, tracker);

    server.failingPings = 0;
    final before = server.pings.length;
    final restarted = TripTracker(
      api: server.api,
      token: 'token-1',
      userId: 'user-1',
      store: store,
      locate: _locate,
    );
    await tester.pump(const Duration(milliseconds: 10));
    expect(server.pings, hasLength(before + 1));
    expect(server.pingIds(server.pings.last).toSet(), offline);
    expect(server.pings.last.url.path, '/api/trips/trip-1/ping');
    expect(restarted.pendingCount, 0);
    expect(restarted.sentCount, 2);
    expect(restarted.status, TripStatus.idle);
    final requests = server.requests.length;
    await tester.pump(_tick * 3);
    expect(server.requests, hasLength(requests));
    restarted.dispose();
  });

  testWidgets('Stored samples of another pilot are left untouched', (
    tester,
  ) async {
    final store = MemoryPingStore();
    await store.add(
      'other-pilot',
      'trip-1',
      PingSample(
        id: 'a' * 32,
        latitude: 14.6,
        longitude: -90.5,
        accuracy: 5,
        timestamp: DateTime.now().toUtc(),
      ),
    );
    final server = _FakeServer();
    final tracker = TripTracker(
      api: server.api,
      token: 'token-1',
      userId: 'user-1',
      store: store,
      locate: _locate,
    );
    await tester.pump(_tick * 2);
    expect(server.requests, isEmpty);
    expect(tracker.pendingCount, 0);
    expect(await store.count('other-pilot'), 1);
    tracker.dispose();
  });

  testWidgets('Trip stays active while samples cannot be delivered', (
    tester,
  ) async {
    final (server, tracker) = await _pumpTrip(tester);
    server.failingPings = 100;
    await tester.pump(_tick);
    await tester.tap(find.text('Terminar viaje'));
    await tester.pump(const Duration(milliseconds: 10));
    expect(server.ends, isEmpty);
    expect(tracker.status, TripStatus.active);
    expect(find.textContaining('sin enviar'), findsOneWidget);

    server.failingPings = 0;
    await tester.tap(find.text('Terminar viaje'));
    await tester.pump(const Duration(milliseconds: 10));
    expect(server.ends, hasLength(1));
    expect(tracker.status, TripStatus.idle);
    await _finish(tester, tracker);
  });

  testWidgets('Expired session stops tracking and asks to log in again', (
    tester,
  ) async {
    var loggedOut = false;
    final (server, tracker) = await _pumpTrip(
      tester,
      onLogout: () => loggedOut = true,
    );
    server.sessionExpired = true;
    await tester.pump(_tick);
    expect(find.text('Volver a iniciar sesión'), findsOneWidget);
    final requests = server.requests.length;
    await tester.pump(_tick * 3);
    expect(server.requests, hasLength(requests));
    await tester.tap(find.text('Volver a iniciar sesión'));
    expect(loggedOut, isTrue);
    await _finish(tester, tracker);
  });

  testWidgets('Busy truck shows the server message without tracking', (
    tester,
  ) async {
    final (server, tracker) = await _pumpTrip(
      tester,
      qr: const TruckCredentials('BUSY', 'camion123!'),
    );
    expect(find.text('Este camión ya tiene un viaje activo.'), findsOneWidget);
    expect(tracker.status, TripStatus.idle);
    await tester.pump(_tick * 2);
    expect(server.pings, isEmpty);
    await _finish(tester, tracker);
  });

  testWidgets('No trip starts without scanning the truck QR', (tester) async {
    final (server, tracker) = await _pumpTrip(tester, qr: null);
    expect(server.requests, isEmpty);
    expect(tracker.status, TripStatus.idle);
    await _finish(tester, tracker);
  });

  testWidgets('Logout is blocked during an active trip', (tester) async {
    var loggedOut = false;
    final (_, tracker) = await _pumpTrip(
      tester,
      onLogout: () => loggedOut = true,
    );
    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pump();
    expect(loggedOut, isFalse);
    expect(
      find.text('Termina el viaje antes de cerrar sesión.'),
      findsOneWidget,
    );
    await _finish(tester, tracker);
  });
}
