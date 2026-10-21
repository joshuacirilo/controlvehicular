import 'dart:async';

import 'package:geolocator/geolocator.dart';

enum GpsQuality { good, fair, poor }

GpsQuality gpsQuality(double accuracy) =>
    !accuracy.isFinite || accuracy <= 0 || accuracy > 50
    ? GpsQuality.poor
    : accuracy <= 20
    ? GpsQuality.good
    : GpsQuality.fair;
String gpsQualityLabel(double accuracy) => switch (gpsQuality(accuracy)) {
  GpsQuality.good => 'Buena',
  GpsQuality.fair => 'Regular',
  GpsQuality.poor => 'Baja',
};

bool isFreshPosition(Position position, DateTime now) {
  final age = now.difference(position.timestamp);
  return age >= Duration.zero && age <= const Duration(seconds: 10);
}

bool usableStartPosition(Position position, DateTime now) =>
    isFreshPosition(position, now) &&
    position.accuracy.isFinite &&
    position.accuracy > 0 &&
    position.accuracy <= 30 &&
    !position.isMocked;

/// Keeps original fixes; these flags describe evidence, not proof of a false location.
List<String> assessPosition(
  Position position,
  Position? previous,
  DateTime now,
) {
  final flags = <String>[
    if (gpsQuality(position.accuracy) == GpsQuality.poor) 'low_accuracy',
    if (!isFreshPosition(position, now)) 'stale',
    if (position.isMocked) 'mocked',
  ];
  if (previous != null) {
    final seconds =
        position.timestamp.difference(previous.timestamp).inMilliseconds / 1000;
    if (seconds <= 0) {
      flags.add('out_of_order');
    } else if (seconds > 30) {
      flags.add('gap');
    } else if (gpsQuality(previous.accuracy) != GpsQuality.poor &&
        gpsQuality(position.accuracy) != GpsQuality.poor) {
      final distance = Geolocator.distanceBetween(
        previous.latitude,
        previous.longitude,
        position.latitude,
        position.longitude,
      );
      // Subtract both uncertainty radii before applying a conservative 160 km/h threshold.
      final minimumDistance = distance - previous.accuracy - position.accuracy;
      if (minimumDistance / seconds * 3.6 > 160) flags.add('jump');
    }
  }
  return flags;
}

Future<Position> waitForStartPosition(
  Future<Position> Function() locate, {
  Duration timeout = const Duration(seconds: 30),
  DateTime Function()? now,
  Future<void> Function(Duration)? pause,
}) async {
  final clock = now ?? DateTime.now;
  final delay = pause ?? Future<void>.delayed;
  final deadline = clock().add(timeout);
  while (clock().isBefore(deadline)) {
    final remaining = deadline.difference(clock());
    final position = await locate().timeout(remaining);
    if (usableStartPosition(position, clock())) return position;
    final left = deadline.difference(clock());
    if (left <= Duration.zero) break;
    await delay(
      left < const Duration(seconds: 1) ? left : const Duration(seconds: 1),
    );
  }
  throw TimeoutException(
    'No se obtuvo una ubicación reciente con precisión de hasta 30 m.',
  );
}
