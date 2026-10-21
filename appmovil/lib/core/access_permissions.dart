import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';

import 'access_permissions_stub.dart'
    if (dart.library.js_interop) 'access_permissions_web.dart'
    as browser;

typedef PermissionCheck = Future<List<String>> Function(bool request);

Future<List<String>> checkPilotPermissions(bool request) async {
  if (kIsWeb) return browser.checkPermissions(request);
  if (defaultTargetPlatform != TargetPlatform.android) {
    return ['Esta plataforma no tiene configurado el acceso del piloto.'];
  }
  const channel = MethodChannel('control_vehicular/permissions');
  final result =
      await channel.invokeMapMethod<String, bool>(
        request ? 'request' : 'check',
      ) ??
      {};
  return [
    if (result['location'] != true) 'Permitir ubicación precisa.',
    if (!await Geolocator.isLocationServiceEnabled())
      'Encender la ubicación del teléfono.',
    if (result['camera'] != true) 'Permitir la cámara para escanear QR.',
    if (result['notifications'] != true)
      'Activar las notificaciones del seguimiento.',
  ];
}
