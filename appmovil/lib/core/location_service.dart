import 'dart:async';

import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

enum LocationIssue {
  serviceDisabled,
  denied,
  deniedForever,
  timeout,
  unavailable,
  approximate,
}

class LocationException implements Exception {
  const LocationException(this.issue);
  final LocationIssue issue;

  String get message => switch (issue) {
    LocationIssue.approximate => 'Activa la ubicación precisa en los permisos de la app para iniciar el viaje.',
    LocationIssue.serviceDisabled => 'La ubicación del dispositivo está desactivada. Actívala e intenta de nuevo.',
    LocationIssue.denied =>
      kIsWeb
          ? 'Permite el acceso a tu ubicación en el navegador para iniciar el viaje.'
          : 'Necesitamos permiso de ubicación para iniciar el viaje.',
    LocationIssue.deniedForever => 'El permiso de ubicación está bloqueado. Habilítalo en los ajustes de la app.',
    LocationIssue.timeout => 'No se obtuvo la ubicación a tiempo. Busca mejor señal e intenta de nuevo.',
    LocationIssue.unavailable =>
      'No se pudo determinar tu ubicación. Intenta de nuevo.',
  };

  /// Settings can only be opened from native platforms.
  bool get canOpenSettings =>
      !kIsWeb &&
      (issue == LocationIssue.serviceDisabled ||
          issue == LocationIssue.deniedForever);
}

/// Returns a single high-accuracy position, or throws [LocationException].
Future<Position> currentLocation({
  Duration timeout = const Duration(seconds: 20),
}) async {
  // On web the browser prompts during getCurrentPosition; the plugin's
  // requestPermission waits without a limit and reports any error as
  // deniedForever, so permission checks are native-only.
  if (!kIsWeb) {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationException(LocationIssue.serviceDisabled);
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationException(LocationIssue.deniedForever);
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.unableToDetermine) {
      throw const LocationException(LocationIssue.denied);
    }
    if (defaultTargetPlatform == TargetPlatform.android &&
        await Geolocator.getLocationAccuracy() !=
            LocationAccuracyStatus.precise) {
      throw const LocationException(LocationIssue.approximate);
    }
  }
  try {
    // geolocator_web passes timeLimit to the browser in the wrong unit, so the
    // limit is enforced here for every platform.
    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    ).timeout(timeout);
  } on TimeoutException {
    throw const LocationException(LocationIssue.timeout);
  } on PermissionDeniedException {
    throw const LocationException(LocationIssue.denied);
  } on LocationServiceDisabledException {
    throw const LocationException(LocationIssue.serviceDisabled);
  } on PositionUpdateException {
    throw const LocationException(LocationIssue.unavailable);
  }
}

/// Whether [backgroundLocationUpdates] can keep tracking with the app in the
/// background on this platform.
bool get backgroundTrackingSupported =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

/// Android position updates every [interval] that keep arriving while the app
/// is in the background: listening runs a foreground service with an ongoing
/// notification, stopped when the subscription is cancelled. Call
/// [currentLocation] first so the permission is already granted.
Stream<Position> backgroundLocationUpdates({
  Duration interval = const Duration(seconds: 5),
}) => Geolocator.getPositionStream(
  locationSettings: AndroidSettings(
    accuracy: LocationAccuracy.high,
    intervalDuration: interval,
    foregroundNotificationConfig: const ForegroundNotificationConfig(
      notificationTitle: 'Viaje en curso',
      notificationText: 'Control vehicular está registrando tu ubicación.',
      notificationChannelName: 'Seguimiento del viaje',
      // Kept in release builds by res/raw/keep.xml: it is only looked up by name.
      notificationIcon: AndroidResource(name: 'ic_notification'),
      color: Color(0xff01215a),
      enableWakeLock: true,
      setOngoing: true,
    ),
  ),
);

/// Maps errors from the position stream to a [LocationException].
LocationException locationErrorFrom(Object error) => switch (error) {
  LocationException() => error,
  PermissionDeniedException() => const LocationException(LocationIssue.denied),
  LocationServiceDisabledException() => const LocationException(
    LocationIssue.serviceDisabled,
  ),
  _ => const LocationException(LocationIssue.unavailable),
};

Future<void> openLocationSettingsFor(LocationIssue issue) async {
  if (issue == LocationIssue.serviceDisabled) {
    await Geolocator.openLocationSettings();
  } else {
    await Geolocator.openAppSettings();
  }
}
