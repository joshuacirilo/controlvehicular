import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import 'api_client.dart';
import 'location_service.dart';
import 'qr_credentials.dart';

enum TripStatus { idle, starting, active, ending }

/// Drives an active trip: samples the location every [interval], queues the
/// samples and delivers them to the API, retrying transient failures.
///
/// The queue lives in memory only; samples still pending are lost if the app
/// is closed.
class TripTracker extends ChangeNotifier {
  TripTracker({
    required this._api,
    required this._token,
    Future<Position> Function()? locate,
    this.interval = const Duration(seconds: 5),
    this.maxQueue = 2000,
  }) : _locate = locate ?? currentLocation;

  final ApiClient _api;
  final String _token;
  final Future<Position> Function() _locate;
  final Duration interval;
  final int maxQueue;

  static const _batchSize = 50;
  static final _random = Random.secure();

  TripStatus status = TripStatus.idle;
  TripInfo? trip;
  DateTime? startedAt;
  Position? lastPosition;

  /// Latest speed computed by the server, in km/h.
  double? speedKmh;
  int sentCount = 0;
  int rejectedCount = 0;
  int droppedCount = 0;
  bool online = true;
  bool sessionExpired = false;

  /// Blocking problem from the last action (start, end or session).
  String? error;

  /// Non-blocking problem while tracking, such as a missed GPS fix.
  String? notice;

  final _pending = <PingSample>[];
  int get pendingCount => _pending.length;

  Timer? _timer;
  Future<void>? _sampling;
  Future<void>? _sending;
  int _failures = 0;
  int _ticksToWait = 0;
  bool _disposed = false;

  Future<void> start(TruckCredentials truck) async {
    if (status != TripStatus.idle || sessionExpired) return;
    _update(() {
      status = TripStatus.starting;
      error = null;
      notice = null;
    });
    try {
      final position = await _locate();
      final info = await _api.startTrip(_token, truck, _sample(position));
      if (_disposed) return;
      _update(() {
        trip = info;
        status = TripStatus.active;
        startedAt = DateTime.now();
        lastPosition = position;
        speedKmh = null;
        sentCount = 1;
        rejectedCount = 0;
        droppedCount = 0;
        online = true;
      });
      _startTimer();
    } on LocationException catch (e) {
      _update(() {
        status = TripStatus.idle;
        error = e.message;
      });
    } on ApiException catch (e) {
      _update(() {
        status = TripStatus.idle;
        error = e.message;
        sessionExpired = e.statusCode == 401;
      });
    } catch (_) {
      _update(() {
        status = TripStatus.idle;
        error = const LocationException(LocationIssue.unavailable).message;
      });
    }
  }

  /// Delivers every pending sample and then closes the trip. The trip stays
  /// active if either step fails.
  Future<void> end() async {
    if (status != TripStatus.active) return;
    _update(() {
      status = TripStatus.ending;
      error = null;
    });
    _timer?.cancel();
    await _sampling;
    await _flush(ignoreBackoff: true);
    if (_disposed) return;
    if (sessionExpired) {
      _update(() => status = TripStatus.active);
      return;
    }
    if (_pending.isNotEmpty) {
      _resume(
        'Quedan $pendingCount ubicaciones sin enviar. '
        'Revisa tu conexión e intenta terminar de nuevo.',
      );
      return;
    }
    try {
      await _api.endTrip(_token, trip!.id);
      if (_disposed) return;
      _update(() {
        status = TripStatus.idle;
        trip = null;
        startedAt = null;
        notice = null;
      });
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        _update(() {
          sessionExpired = true;
          status = TripStatus.active;
          error = e.message;
        });
      } else {
        _resume(e.message);
      }
    }
  }

  void _resume(String message) {
    _update(() {
      status = TripStatus.active;
      error = message;
    });
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => _tick());
  }

  void _tick() {
    if (status != TripStatus.active || _sampling != null) return;
    _sampling = _takeSample().whenComplete(() => _sampling = null);
  }

  Future<void> _takeSample() async {
    try {
      final position = await _locate();
      if (_disposed || trip == null) return;
      if (_pending.length >= maxQueue) {
        _pending.removeAt(0);
        droppedCount++;
      }
      _pending.add(_sample(position));
      lastPosition = position;
      notice = null;
    } on LocationException catch (e) {
      notice = e.message;
    } catch (_) {
      notice = const LocationException(LocationIssue.unavailable).message;
    }
    _notify();
    if (_ticksToWait > 0) {
      _ticksToWait--;
      return;
    }
    await _flush();
  }

  Future<void> _flush({bool ignoreBackoff = false}) async {
    await (_sending ??= _send().whenComplete(() => _sending = null));
    if (ignoreBackoff && _pending.isNotEmpty && !sessionExpired) {
      await (_sending ??= _send().whenComplete(() => _sending = null));
    }
  }

  Future<void> _send() async {
    while (_pending.isNotEmpty && trip != null && !sessionExpired) {
      final batch = _pending.take(_batchSize).toList();
      try {
        final result = await _api.sendPings(_token, trip!.id, batch);
        if (_disposed) return;
        final before = _pending.length;
        _pending.removeWhere(
          (p) =>
              result.accepted.contains(p.id) || result.rejected.contains(p.id),
        );
        sentCount += batch.where((p) => result.accepted.contains(p.id)).length;
        rejectedCount += batch
            .where((p) => result.rejected.contains(p.id))
            .length;
        if (result.speedKmh != null) speedKmh = result.speedKmh;
        online = true;
        _failures = 0;
        _ticksToWait = 0;
        if (!result.tripActive && status == TripStatus.active) {
          _closedRemotely('El viaje fue cerrado desde administración.');
          return;
        }
        _notify();
        // Stop if the server acknowledged nothing, rather than resending forever.
        if (_pending.length == before) return;
      } on ApiException catch (e) {
        if (_disposed) return;
        if (e.statusCode == 400) {
          // Invalid data never succeeds on retry; count it instead of looping.
          _pending.removeWhere(batch.contains);
          rejectedCount += batch.length;
          _notify();
          continue;
        }
        if (e.statusCode == 404) {
          _closedRemotely(e.message);
          return;
        }
        if (e.statusCode == 401) {
          _timer?.cancel();
          sessionExpired = true;
          error = e.message;
        } else {
          online = false;
          _failures++;
          _ticksToWait = (1 << min(_failures - 1, 4)) - 1;
        }
        _notify();
        return;
      }
    }
  }

  void _closedRemotely(String message) {
    _timer?.cancel();
    rejectedCount += _pending.length;
    _pending.clear();
    status = TripStatus.idle;
    trip = null;
    startedAt = null;
    error = message;
    _notify();
  }

  PingSample _sample(Position position) => PingSample(
    id: [
      for (var i = 0; i < 16; i++)
        _random.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ].join(),
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: position.accuracy,
    timestamp: position.timestamp.toUtc(),
  );

  void _update(VoidCallback change) {
    if (_disposed) return;
    change();
    notifyListeners();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
