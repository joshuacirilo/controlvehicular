import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:control_vehicular/core/gps_quality.dart';

final base = DateTime.utc(2026, 10, 19, 12);
Position fix({
  double accuracy = 10,
  int seconds = 0,
  double lat = 14.6,
  bool mocked = false,
}) => Position(
  latitude: lat,
  longitude: -90.5,
  timestamp: base.add(Duration(seconds: seconds)),
  accuracy: accuracy,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
  isMocked: mocked,
);
void main() {
  test('quality boundaries and unknown precision', () {
    expect(gpsQuality(20), GpsQuality.good);
    expect(gpsQuality(20.1), GpsQuality.fair);
    expect(gpsQuality(50), GpsQuality.fair);
    for (final value in [0.0, -1.0, 50.1, double.nan, double.infinity]) {
      expect(gpsQuality(value), GpsQuality.poor);
    }
  });
  test('start requires a recent, precise, non-mocked fix', () {
    expect(usableStartPosition(fix(accuracy: 30, seconds: -10), base), isTrue);
    expect(usableStartPosition(fix(accuracy: 31), base), isFalse);
    expect(usableStartPosition(fix(seconds: -11), base), isFalse);
    expect(usableStartPosition(fix(seconds: 1), base), isFalse);
    expect(usableStartPosition(fix(mocked: true), base), isFalse);
  });
  test('waits for a better fix and preserves its timestamp', () async {
    var now = base;
    var calls = 0;
    final result = await waitForStartPosition(
      () async => ++calls == 1 ? fix(accuracy: 500) : fix(seconds: 1),
      now: () => now,
      pause: (duration) async {
        now = now.add(duration);
      },
    );
    expect(calls, 2);
    expect(result.timestamp, base.add(const Duration(seconds: 1)));
  });
  test('poor signal times out instead of starting', () async {
    var now = base;
    await expectLater(
      waitForStartPosition(
        () async => fix(accuracy: 500),
        timeout: const Duration(seconds: 3),
        now: () => now,
        pause: (duration) async {
          now = now.add(duration);
        },
      ),
      throwsA(isA<TimeoutException>()),
    );
  });
  test(
    'marks jumps with conservative accuracy allowance, gaps and stale fixes',
    () {
      expect(
        assessPosition(
          fix(seconds: 5, lat: 14.62),
          fix(),
          base.add(const Duration(seconds: 5)),
        ),
        contains('jump'),
      );
      expect(
        assessPosition(
          fix(seconds: 5, lat: 14.6001),
          fix(),
          base.add(const Duration(seconds: 5)),
        ),
        isEmpty,
      );
      expect(
        assessPosition(
          fix(seconds: 31),
          fix(),
          base.add(const Duration(seconds: 31)),
        ),
        contains('gap'),
      );
      expect(
        assessPosition(fix(), fix(), base.add(const Duration(seconds: 20))),
        containsAll(['stale', 'out_of_order']),
      );
      expect(
        assessPosition(fix(accuracy: 500), null, base),
        contains('low_accuracy'),
      );
    },
  );
}
