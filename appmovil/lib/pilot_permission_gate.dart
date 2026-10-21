import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import 'core/access_permissions.dart';

/// Owns the protected subtree: the tracker is created only after access succeeds.
class PilotPermissionGate extends StatefulWidget {
  const PilotPermissionGate({
    super.key,
    required this.check,
    required this.onReady,
  });
  final PermissionCheck check;
  final Future<void> Function() onReady;
  @override
  State<PilotPermissionGate> createState() => _PilotPermissionGateState();
}

class _PilotPermissionGateState extends State<PilotPermissionGate>
    with WidgetsBindingObserver {
  bool _busy = false;
  List<String> _missing = [];
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _verify(true));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !kIsWeb) _verify(false);
  }

  Future<void> _verify(bool request) async {
    if (_busy || !mounted) return;
    setState(() => _busy = true);
    try {
      final missing = await widget.check(request);
      if (!mounted) return;
      setState(() => _missing = missing);
      if (missing.isEmpty) await widget.onReady();
    } catch (_) {
      if (mounted) {
        setState(
          () => _missing = [
            'No se pudieron verificar los permisos. Intenta de nuevo.',
          ],
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Permisos del piloto')),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Para continuar necesitamos ubicación precisa, cámara para los QR y, en Android, notificaciones del seguimiento.',
              ),
              const SizedBox(height: 16),
              for (final message in _missing)
                ListTile(
                  leading: const Icon(Icons.warning_amber),
                  title: Text(message),
                ),
              if (_busy) const CircularProgressIndicator(),
              FilledButton(
                onPressed: _busy ? null : () => _verify(true),
                child: const Text('Verificar permisos'),
              ),
              if (!kIsWeb) ...[
                TextButton(
                  onPressed: _busy ? null : Geolocator.openAppSettings,
                  child: const Text('Abrir ajustes de la app'),
                ),
                TextButton(
                  onPressed: _busy ? null : Geolocator.openLocationSettings,
                  child: const Text('Activar ubicación'),
                ),
              ],
              if (kIsWeb)
                const Text(
                  'Si bloqueaste un permiso, habilítalo en los ajustes del sitio y vuelve a verificar.',
                ),
            ],
          ),
        ),
      ),
    ),
  );
}
