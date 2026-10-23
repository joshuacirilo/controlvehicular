import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import 'api_client.dart';

typedef AssignmentNotifier = Future<void> Function(TripAssignment assignment);

String _two(int n) => n.toString().padLeft(2, '0');

/// Day and time on the phone's clock, e.g. `24/10/2026 08:00`.
String formatSchedule(DateTime instant) {
  final local = instant.toLocal();
  return '${_two(local.day)}/${_two(local.month)}/${local.year} '
      '${_two(local.hour)}:${_two(local.minute)}';
}

/// Posts an Android system notification; other platforms only show the
/// in-app list.
Future<void> showAssignmentNotification(TripAssignment assignment) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  await const MethodChannel('control_vehicular/notifications')
      .invokeMethod('showAssignment', {
        'id': assignment.id,
        'title': 'Viaje asignado · ${assignment.plate}',
        'body':
            'Salida ${formatSchedule(assignment.scheduledAt)}: '
            '${assignment.origin.label} → ${assignment.destination.label}',
      });
}

/// Polls the pilot's assigned trips every [interval] and when the app returns
/// to the foreground. Each new assignment raises one system notification and
/// is then reported to the server as delivered.
class AssignmentWatcher extends ChangeNotifier with WidgetsBindingObserver {
  AssignmentWatcher({
    required this._api,
    required this._token,
    AssignmentNotifier? notify,
    this.interval = const Duration(minutes: 1),
  }) : _notify = notify ?? showAssignmentNotification {
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(interval, (_) => unawaited(refresh()));
    unawaited(refresh());
  }

  final ApiClient _api;
  final String _token;
  final AssignmentNotifier _notify;
  final Duration interval;
  Timer? _timer;
  Future<void>? _refreshing;
  bool _disposed = false;

  /// Notified in this process, so a failed `delivered` report does not repeat
  /// the system notification every minute.
  final _notified = <String>{};

  /// Pending and in-progress assignments, earliest departure first.
  List<TripAssignment> assignments = const [];
  bool loaded = false;
  String? error;

  int get unreadCount => assignments.where((a) => !a.read).length;
  TripAssignment? get nextPending =>
      assignments.where((a) => a.pending).firstOrNull;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refresh());
  }

  Future<void> refresh() =>
      _refreshing ??= _load().whenComplete(() => _refreshing = null);

  Future<void> _load() async {
    final List<TripAssignment> items;
    try {
      items = await _api.assignments(_token);
    } on ApiException catch (e) {
      if (_disposed) return;
      error = e.statusCode == null
          ? 'Sin conexión: no se pudieron actualizar las notificaciones.'
          : e.message;
      notifyListeners();
      return;
    }
    if (_disposed) return;
    assignments = items;
    loaded = true;
    error = null;
    notifyListeners();
    for (final item in items) {
      if (item.delivered || !_notified.add(item.id)) continue;
      try {
        await _notify(item);
      } catch (_) {
        // The in-app list still shows it.
      }
      try {
        await _api.markAssignment(_token, item.id, AssignmentMark.delivered);
        _replace(item.id, (a) => a.copyWith(delivered: true));
      } on ApiException {
        // Reported again on the next refresh.
      }
    }
  }

  Future<void> markRead(TripAssignment assignment) async {
    if (assignment.read) return;
    _replace(assignment.id, (a) => a.copyWith(read: true, delivered: true));
    try {
      await _api.markAssignment(_token, assignment.id, AssignmentMark.read);
    } on ApiException {
      _replace(assignment.id, (a) => a.copyWith(read: false));
    }
  }

  void _replace(String id, TripAssignment Function(TripAssignment) change) {
    if (_disposed) return;
    assignments = [for (final a in assignments) a.id == id ? change(a) : a];
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
