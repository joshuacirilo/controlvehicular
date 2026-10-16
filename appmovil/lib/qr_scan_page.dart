import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'core/qr_credentials.dart';

Rect _scanWindow(Size size) {
  final side = math.min(math.min(size.width, size.height) * 0.7, 280.0);
  return Rect.fromCenter(
    center: size.center(Offset.zero),
    width: side,
    height: side,
  );
}

class _ScanFramePainter extends CustomPainter {
  const _ScanFramePainter(this.window);
  final Rect window;

  @override
  void paint(Canvas canvas, Size size) {
    final frame = RRect.fromRectAndRadius(window, const Radius.circular(16));
    canvas.drawPath(
      Path()
        ..fillType = PathFillType.evenOdd
        ..addRect(Offset.zero & size)
        ..addRRect(frame),
      Paint()..color = const Color(0x99000000),
    );
    canvas.drawRRect(
      frame,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(_ScanFramePainter old) => old.window != window;
}

class QrLoginPage extends StatefulWidget {
  const QrLoginPage({super.key});
  @override
  State<QrLoginPage> createState() => _QrLoginPageState();
}

class _QrLoginPageState extends State<QrLoginPage> {
  bool _accepted = false;
  String? _error;
  void _detect(BarcodeCapture capture) {
    if (_accepted || !mounted) return;
    for (final barcode in capture.barcodes) {
      if (barcode.format != BarcodeFormat.qrCode || barcode.rawValue == null) {
        continue;
      }
      try {
        final credentials = QrCredentials.parse(barcode.rawValue!);
        // Ignore repeated frames and remove the scanner to release the camera.
        setState(() => _accepted = true);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.of(context).pop(credentials);
        });
        return;
      } on FormatException catch (e) {
        if (_error != e.message) setState(() => _error = e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ingresar con QR')),
    body: SafeArea(
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.all(20),
            child: Text(
              'Coloca el QR de acceso dentro del recuadro. Validaremos tus credenciales con el servidor.',
              textAlign: TextAlign.center,
            ),
          ),
          Expanded(
            child: _accepted
                ? const Center(child: CircularProgressIndicator())
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final window = _scanWindow(constraints.biggest);
                      return MobileScanner(
                        onDetect: _detect,
                        // The web scanner cannot locate codes inside a window.
                        scanWindow: kIsWeb ? null : window,
                        overlayBuilder: (context, _) => CustomPaint(
                          size: constraints.biggest,
                          painter: _ScanFramePainter(window),
                        ),
                        errorBuilder: (context, error) => Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.no_photography_outlined,
                                  size: 48,
                                ),
                                const SizedBox(height: 16),
                                const Text(
                                  'No se pudo abrir la cámara. Revisa el permiso del navegador y que exista una cámara disponible.',
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 16),
                                TextButton(
                                  onPressed: () => Navigator.of(context).pop(),
                                  child: const Text('Volver al login'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
          ),
        ],
      ),
    ),
  );
}
