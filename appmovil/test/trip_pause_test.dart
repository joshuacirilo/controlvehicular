import 'dart:async';
import 'dart:convert';

import 'package:control_vehicular/core/api_client.dart';
import 'package:control_vehicular/core/qr_credentials.dart';
import 'package:control_vehicular/core/session_store.dart';
import 'package:control_vehicular/core/trip_tracker.dart';
import 'package:control_vehicular/trip_home_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _json = {'content-type': 'application/json; charset=utf-8'};
const _pausedSince = '2026-10-23T10:00:00-06:00';

class _Server {
  final calls = <String>[];
  final movements = <double>[];
  int pingCount = 0;
  int failingResumes = 0;
  String activeTrip = '{"trip":null}';
  late final api = ApiClient(client: MockClient(_handle));

  int count(String action) => calls.where((c) => c == action).length;

  Future<http.Response> _handle(http.Request request) async {
    final path = request.url.path;
    http.Response reply(Object body, [int status = 200]) =>
        http.Response(jsonEncode(body), status, headers: _json);
    final action = path.split('/').last;
    calls.add(action);
    switch (path) {
      case '/api/trips/active':
        return http.Response(activeTrip, 200, headers: _json);
      case '/api/trips/start':
        return reply({
          'tripId': 'trip-1',
          'truck': {'placa': 'P123ABC', 'modelo': 'Hino'},
        }, 201);
      case '/api/trips/trip-1/pause':
        return reply({
          'tripId': 'trip-1',
          'pausado': true,
          'pausadoDesde': _pausedSince,
        });
      case '/api/trips/trip-1/resume':
        if (failingResumes > 0) {
          failingResumes--;
          return reply({'message': 'No disponible.'}, 503);
        }
        return reply({
          'tripId': 'trip-1',
          'pausado': false,
          'pausadoDesde': null,
        });
      case '/api/trips/trip-1/pause-movement':
        movements.add(
          ((jsonDecode(request.body) as Map)['velocidadKmh'] as num).toDouble(),
        );
        return reply({'tripId': 'trip-1', 'registrado': true});
      case '/api/trips/trip-1/ping':
        final ids = [
          for (final p in (jsonDecode(request.body) as Map)['pings'] as List)
            (p as Map)['pingId'],
        ];
        pingCount += ids.length;
        return reply({'estado': 'activo', 'accepted': ids, 'rejected': []});
    }
    return reply({'message': 'Unexpected $path'}, 500);
  }
}

var _step = 0;
Position _position({double speed = 0, double speedAccuracy = 0}) {
  _step++;
  return Position(
    latitude: 14.6349 + _step * 0.0003,
    longitude: -90.5069,
    timestamp: DateTime.now().add(Duration(seconds: _step * 5)),
    accuracy: 5,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: speed,
    speedAccuracy: speedAccuracy,
  );
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
  testWidgets(
    'a paused trip stores no locations, reminds the pilot once when moving and resumes recording',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final server = _Server();
      final positions = StreamController<Position>.broadcast();
      final reminders = <double>[];
      final sessions = MemorySessionStore();
      final tracker = TripTracker(
        api: server.api,
        token: 'token-1',
        userId: 'u1',
        sessionStore: sessions,
        locate: _locate,
        watch: () => positions.stream,
        remindPause: (kmh) async => reminders.add(kmh),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: TripHomePage(
            name: 'Piloto',
            tracker: tracker,
            onLogout: () {},
            scanTruckQr: (_) async =>
                const TruckCredentials('P123ABC', 'camion123!'),
          ),
        ),
      );
      Future<void> emit(Position position) async {
        positions.add(position);
        await tester.pump();
        await tester.pump();
      }

      await tester.tap(find.text('Iniciar viaje'));
      await tester.pump(const Duration(milliseconds: 10));
      await tester.pump();
      expect(tracker.status, TripStatus.active);
      await emit(_position());
      expect(tracker.pendingCount, 1);

      await tester.tap(find.text('Pausar viaje'));
      await tester.pump();
      await tester.pump();
      expect(server.count('pause'), 1);
      expect(tracker.paused, isTrue);
      expect(sessions.trip?.pausedSince, DateTime.parse(_pausedSince));
      expect(find.text('Reanudar viaje'), findsOneWidget);
      expect(find.text('Viaje en pausa'), findsOneWidget);
      expect(find.text('Tu viaje está en pausa.'), findsOneWidget);

      // Walking pace and a single fast fix are not movement.
      await emit(_position(speed: 1.2, speedAccuracy: 0.5));
      await emit(_position(speed: 9, speedAccuracy: 1));
      await emit(_position(speed: 1, speedAccuracy: 0.5));
      expect(reminders, isEmpty);

      await emit(_position(speed: 8, speedAccuracy: 1));
      await emit(_position(speed: 8, speedAccuracy: 1));
      expect(reminders, hasLength(1));
      expect(reminders.single, closeTo(25.2, 0.01));
      expect(server.movements, hasLength(1));
      expect(find.textContaining('Se detectó movimiento (25 km/h)'), findsOne);

      // Repeated movement within five minutes neither reminds nor reports again.
      await emit(_position(speed: 15, speedAccuracy: 1));
      await emit(_position(speed: 15, speedAccuracy: 1));
      expect(reminders, hasLength(1));
      expect(server.movements, hasLength(1));
      expect(tracker.pendingCount, 1, reason: 'paused fixes are not stored');

      await tester.tap(find.text('Reanudar viaje'));
      await tester.pump();
      await tester.pump();
      expect(server.count('resume'), 1);
      expect(tracker.paused, isFalse);
      expect(sessions.trip?.pausedSince, isNull);
      expect(find.text('Pausar viaje'), findsOneWidget);
      expect(find.textContaining('Se detectó movimiento'), findsNothing);
      await emit(_position(speed: 15, speedAccuracy: 1));
      expect(tracker.pendingCount, 2);

      await tester.pumpWidget(const SizedBox());
      tracker.dispose();
      await positions.close();
    },
  );

  testWidgets(
    'resuming without connection records at once and retries the server',
    (tester) async {
      final server = _Server()
        ..activeTrip = jsonEncode({
          'trip': {
            'tripId': 'trip-1',
            'inicio': '2026-10-23T09:00:00-06:00',
            'truck': {'placa': 'P123ABC', 'modelo': 'Hino'},
            'pausadoDesde': _pausedSince,
          },
        })
        ..failingResumes = 1;
      final positions = StreamController<Position>.broadcast();
      final tracker = TripTracker(
        api: server.api,
        token: 'token-1',
        userId: 'u1',
        locate: _locate,
        watch: () => positions.stream,
        remindPause: (_) async {},
        uploadInterval: const Duration(seconds: 5),
      );
      await tracker.resumeActiveTrip();
      expect(
        tracker.paused,
        isTrue,
        reason: 'the pause survives an app restart',
      );

      await tracker.resume();
      expect(tracker.paused, isFalse);
      expect(server.count('resume'), 1);
      positions.add(_position());
      await tester.pump();
      await tester.pump();
      expect(tracker.pendingCount, 1);

      await tester.pump(const Duration(seconds: 6));
      await tester.pump();
      expect(server.count('resume'), 2);
      expect(server.pingCount, 1);

      tracker.dispose();
      await positions.close();
    },
  );
}
