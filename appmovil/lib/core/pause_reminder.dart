import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

typedef PauseReminder = Future<void> Function(double speedKmh);

/// Posts an Android system notification asking the pilot to resume the trip;
/// other platforms only show the warning on screen.
Future<void> showPauseReminder(double speedKmh) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  await const MethodChannel('control_vehicular/notifications')
      .invokeMethod('showPauseReminder', {
        'title': 'Tu viaje está en pausa',
        'body':
            'Se detectó movimiento (${speedKmh.round()} km/h). '
            'Abre la app y toca "Reanudar viaje" para registrar el recorrido.',
      });
}
