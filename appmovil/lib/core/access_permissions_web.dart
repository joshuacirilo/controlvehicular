import 'dart:js_interop';

import 'package:geolocator/geolocator.dart';

@JS('navigator.mediaDevices')
external _MediaDevices? get _devices;

extension type _MediaDevices(JSObject _) implements JSObject {
  external JSPromise<_Stream> getUserMedia(JSObject constraints);
}

extension type _Stream(JSObject _) implements JSObject {
  external JSArray<_Track> getTracks();
}

extension type _Track(JSObject _) implements JSObject {
  external void stop();
}

Future<List<String>> checkPermissions(bool request) async {
  // Browsers do not expose Android's precise-location or notification-service permissions.
  // Explicit retry verifies actual access and immediately releases the camera.
  if (!request) {
    return [
      'Pulsa Verificar permisos para comprobar cámara y ubicación en el navegador.',
    ];
  }
  final missing = <String>[];
  try {
    await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    ).timeout(const Duration(seconds: 20));
  } catch (_) {
    missing.add(
      'Permitir ubicación en el navegador y comprobar que esté disponible.',
    );
  }
  try {
    final devices = _devices;
    if (devices == null) throw StateError('Camera unavailable');
    final stream = await devices
        .getUserMedia({'video': true, 'audio': false}.jsify()! as JSObject)
        .toDart;
    for (final track in stream.getTracks().toDart) {
      track.stop();
    }
  } catch (_) {
    missing.add(
      'Permitir la cámara en el navegador (requiere HTTPS o localhost).',
    );
  }
  return missing;
}
