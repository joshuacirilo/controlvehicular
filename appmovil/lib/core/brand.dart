import 'package:flutter/material.dart';

/// Palette taken from the app icon; the admin panel uses the same values.
abstract final class BrandColors {
  static const navy = Color(0xff01215a);
  static const navyLight = Color(0xff012d76);
  static const blue = Color(0xff0349b9);
  static const cyan = Color(0xff34e1ff);
  static const teal = Color(0xff0ddddf);
  static const surface = Color(0xfff1f5f9);
  static const muted = Color(0xff526078);
}

const brandIconAsset = 'assets/icon/app_icon.png';

ThemeData buildBrandTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: BrandColors.blue,
    primary: BrandColors.blue,
    secondary: BrandColors.teal,
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: BrandColors.surface,
    appBarTheme: const AppBarTheme(
      backgroundColor: BrandColors.navy,
      foregroundColor: Colors.white,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      focusedBorder: OutlineInputBorder(
        borderSide: BorderSide(color: BrandColors.blue, width: 2),
      ),
    ),
  );
}

/// The app icon with its rounded corners, used as the brand mark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 64});
  final double size;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(size * 0.22),
    child: Image.asset(
      brandIconAsset,
      width: size,
      height: size,
      semanticLabel: 'Control vehicular',
    ),
  );
}
