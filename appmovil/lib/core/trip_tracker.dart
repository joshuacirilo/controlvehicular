import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import 'api_client.dart';
import 'location_service.dart';
import 'ping_store.dart';
import 'qr_credentials.dart';
import 'session_store.dart';

enum TripStatus { idle, starting, active, ending }

/// Drives an active trip: samples the location every [interval], stores the
/// samples on the device and delivers them to the API, retrying transient
/// failures.
///
/// Samples stay in the [PingStore] until the server acknowledges them, so the
/// ones taken without connection are sent later, also after the app restarts
/// and the same pilot ([userId]) signs in again.
///
/// With [watch], samples come from that continuous stream during the trip
/// (on Android it keeps tracking with the app in the background); otherwise
/// [locate] is polled every [interval].
///
/// With [sessionStore], the active trip is saved on the device so
/// [resumeActiveTrip] can continue it after the app restarts, and a session
/// rejected by the server is forgotten.
class TripTracker extends ChangeNotifier {
  TripTracker({
    required this._api,
    required this._token,
    required this.userId,
    PingStore? store,
    this._sessionStore,
    Future<Position> Function()? locate,
    this._watch,
    this.interval = const Duration(seconds: 5),
    this.maxQueue = 120000,
  }) : _store = store ?? MemoryPingStore(),
       _locate = locate ?? currentLocation {
    unawaited(_restore());
  }

  final ApiClient _api;
  final String _token;
  final String userId;
  final PingStore _store;
  final SessionStore? _sessionStore;
  final Future<Position> Function() _locate;
  final Stream<Position> Function()? _watch;
  final Duration interval;

  /// Pending samples kept per pilot; the default is about seven days at 5 s.
  final int maxQueue;

  static const _batchSize = 50;

  /// The server rejects a whole batch containing a sample older than 7 days.
  static const _maxAge = Duration(days: 6, hours: 23);
  static const _storageProblem =
      'No se pudo guardar la ubicación en el teléfono.';
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

  /// Samples of this pilot stored on the device and not yet acknowledged,
  /// including those left by earlier trips or sessions.
  int pendingCount = 0;

  /// False when pending samples would be lost if the app closes.
  bool get persistent => _store.persistent;

  /// Whether tracking continues with the app in the background.
  bool get tracksInBackground => _watch != null;

  Timer? _timer;
  StreamSubscription<Position>? _positions;
  DateTime? _lastSampleAt;
  Future<void>? _sampling;
  Future<void>? _sending;
  int _failures = 0;
  int _ticksToWait = 0;
  bool _disposed = false;

  Future<void> _restore() async {
    await _refreshPending();
    if (_disposed || pendingCount == 0) return;
    _startTimer();
    _tick();
  }

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
      final started = info.startedAt ?? DateTime.now();
      unawaited(_saveTrip(info.withStart(started)));
      _update(() {
        trip = info;
        status = TripStatus.active;
        startedAt = started;
        lastPosition = position;
        speedKmh = null;
        sentCount = 1;
        rejectedCount = 0;
        droppedCount = 0;
        online = true;
      });
      _lastSampleAt = position.timestamp;
      _startTimer();
      _watchPositions();
    } on LocationException catch (e) {
      _update(() {
        status = TripStatus.idle;
        error = e.message;
      });
    } on ApiException catch (e) {
      _update(() {
        status = TripStatus.idle;
        error = e.message;
      });
      if (e.statusCode == 401) _sessionClosed();
    } catch (_) {
      _update(() {
        status = TripStatus.idle;
        error = const LocationException(LocationIssue.unavailable).message;
      });
    }
  }

  /// Continues the pilot's active trip after the app restarted, without the
  /// truck QR. The server decides; without connection the trip saved on the
  /// device is used and later pings reconcile it with the server.
  Future<void> resumeActiveTrip() async {
    if (status != TripStatus.idle || sessionExpired) return;
    TripInfo? info;
    try {
      info = await _api.activeTrip(_token);
      if (info == null) {
        await _forgetTrip();
      } else {
        await _saveTrip(info);
      }
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        _update(() => error = e.message);
        _sessionClosed();
        return;
      }
      try {
        info = await _sessionStore?.readTrip();
      } catch (_) {
        info = null;
      }
    }
    if (_disposed || info == null || status != TripStatus.idle) return;
    final resumed = info;
    _update(() {
      trip = resumed;
      status = TripStatus.active;
      startedAt = resumed.startedAt ?? DateTime.now();
      speedKmh = null;
      error = null;
      notice = null;
    });
    _startTimer();
    _watchPositions();
  }

  /// Delivers every pending sample and then closes the trip. The trip stays
  /// active if either step fails.
  Future<void> end() async {
    if (status != TripStatus.active) return;
    _update(() {
      status = TripStatus.ending;
      error = null;
    });
    _stopTimer();
    _stopWatching();
    await _sampling;
    await _flush(ignoreBackoff: true);
    if (_disposed || trip == null) return;
    if (sessionExpired) {
      _update(() => status = TripStatus.active);
      return;
    }
    if (pendingCount > 0) {
      _resume(
        'Quedan $pendingCount ubicaciones sin enviar. '
        'Revisa tu conexión e intenta terminar de nuevo.',
      );
      return;
    }
    try {
      await _api.endTrip(_token, trip!.id);
      if (_disposed) return;
      unawaited(_forgetTrip());
      _update(() {
        status = TripStatus.idle;
        trip = null;
        startedAt = null;
        notice = null;
      });
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        _update(() {
          status = TripStatus.active;
          error = e.message;
        });
        _sessionClosed();
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
    _watchPositions();
  }

  void _watchPositions() {
    final watch = _watch;
    if (watch == null || _positions != null || _disposed) return;
    if (status != TripStatus.active) return;
    _positions = watch().listen(
      _onPosition,
      onError: (Object e) {
        // The next tick subscribes again, so a re-enabled GPS resumes tracking.
        _positions = null;
        notice = locationErrorFrom(e).message;
        _notify();
      },
      onDone: () => _positions = null,
      cancelOnError: true,
    );
  }

  void _stopWatching() {
    final positions = _positions;
    _positions = null;
    unawaited(positions?.cancel());
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => _tick());
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  void _tick() {
    if (_sampling != null || status == TripStatus.ending) return;
    _sampling = _cycle().whenComplete(() => _sampling = null);
  }

  Future<void> _cycle() async {
    if (status == TripStatus.active) {
      if (_watch == null) {
        await _takeSample();
      } else {
        _watchPositions();
      }
    }
    if (_ticksToWait > 0) {
      _ticksToWait--;
      return;
    }
    await _flush();
    if (status == TripStatus.idle && pendingCount == 0) _stopTimer();
  }

  Future<void> _takeSample() async {
    final Position position;
    try {
      position = await _locate();
    } on LocationException catch (e) {
      notice = e.message;
      _notify();
      return;
    } catch (_) {
      notice = const LocationException(LocationIssue.unavailable).message;
      _notify();
      return;
    }
    await _record(position);
  }

  void _onPosition(Position position) {
    final last = _lastSampleAt;
    // The platform may deliver fixes more often than requested.
    if (last != null && position.timestamp.difference(last) < interval * 0.8) {
      return;
    }
    _lastSampleAt = position.timestamp;
    unawaited(_record(position));
  }

  Future<void> _record(Position position) async {
    final tripId = trip?.id;
    if (_disposed || tripId == null || status != TripStatus.active) return;
    try {
      if (pendingCount >= maxQueue) {
        droppedCount += await _store.trim(userId, maxQueue - 1);
      }
      await _store.add(userId, tripId, _sample(position));
      lastPosition = position;
      notice = null;
    } catch (_) {
      notice = _storageProblem;
    }
    await _refreshPending();
  }

  Future<void> _flush({bool ignoreBackoff = false}) async {
    await (_sending ??= _send().whenComplete(() => _sending = null));
    if (ignoreBackoff && pendingCount > 0 && !sessionExpired) {
      await (_sending ??= _send().whenComplete(() => _sending = null));
    }
  }

  Future<void> _send() async {
    try {
      droppedCount += await _store.removeOlderThan(
        userId,
        DateTime.now().toUtc().subtract(_maxAge),
      );
      while (!sessionExpired && !_disposed) {
        final batch = await _store.next(userId, _batchSize);
        if (batch == null || !await _deliver(batch)) break;
      }
    } catch (_) {
      notice = _storageProblem;
    }
    await _refreshPending();
  }

  /// Sends one batch and forgets the samples the server acknowledged.
  /// Returns whether to continue with the next batch.
  Future<bool> _deliver(PendingBatch batch) async {
    final current = batch.tripId == trip?.id;
    final ids = [for (final ping in batch.pings) ping.id];
    final PingResult result;
    try {
      result = await _api.sendPings(_token, batch.tripId, batch.pings);
    } on ApiException catch (e) {
      if (_disposed) return false;
      if (e.statusCode == 400) {
        // Invalid data never succeeds on retry; count it instead of looping.
        await _store.remove(ids);
        rejectedCount += ids.length;
        return true;
      }
      if (e.statusCode == 404) {
        // The trip is not this pilot's: none of its samples can be stored.
        rejectedCount += await _store.removeTrip(userId, batch.tripId);
        if (current) _closedRemotely(e.message);
        return true;
      }
      if (e.statusCode == 401) {
        error = e.message;
        _sessionClosed();
      } else {
        online = false;
        _failures++;
        _ticksToWait = (1 << min(_failures - 1, 4)) - 1;
      }
      _notify();
      return false;
    }
    if (_disposed) return false;
    final acknowledged = [
      for (final id in ids)
        if (result.accepted.contains(id) || result.rejected.contains(id)) id,
    ];
    await _store.remove(acknowledged);
    sentCount += ids.where(result.accepted.contains).length;
    rejectedCount += ids.where(result.rejected.contains).length;
    if (current && result.speedKmh != null) speedKmh = result.speedKmh;
    online = true;
    _failures = 0;
    _ticksToWait = 0;
    if (current && !result.tripActive && status == TripStatus.active) {
      // Samples taken before the close are still accepted: keep sending them.
      _closedRemotely('El viaje fue cerrado desde administración.');
    }
    await _refreshPending();
    // Stop if the server acknowledged nothing, rather than resending forever.
    return acknowledged.isNotEmpty;
  }

  /// The server rejected the token (logout elsewhere or deactivated pilot):
  /// stop working and forget the saved session. The trip stays active on the
  /// server and is resumed after signing in again.
  void _sessionClosed() {
    _stopTimer();
    _stopWatching();
    sessionExpired = true;
    unawaited(_guard(() => _sessionStore?.clear()));
    _notify();
  }

  Future<void> _saveTrip(TripInfo info) =>
      _guard(() => _sessionStore?.saveTrip(info));

  Future<void> _forgetTrip() => _guard(() => _sessionStore?.clearTrip());

  /// A failing session store must not break tracking: the trip continues and
  /// at worst is not restored after a restart.
  Future<void> _guard(Future<void>? Function() action) async {
    try {
      await action();
    } catch (_) {}
  }

  void _closedRemotely(String message) {
    _stopWatching();
    unawaited(_forgetTrip());
    status = TripStatus.idle;
    trip = null;
    startedAt = null;
    error = message;
    _notify();
  }

  Future<void> _refreshPending() async {
    try {
      final count = await _store.count(userId);
      if (_disposed) return;
      pendingCount = count;
    } catch (_) {
      // Keep the last known count; the next store operation reports the issue.
    }
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
    _stopTimer();
    _stopWatching();
    super.dispose();
  }
}
