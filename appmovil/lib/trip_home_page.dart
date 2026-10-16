import 'package:flutter/material.dart';

import 'core/trip_tracker.dart';
import 'core/truck_qr.dart';
import 'qr_scan_page.dart';

class TripHomePage extends StatelessWidget {
  const TripHomePage({
    super.key,
    required this.name,
    required this.tracker,
    required this.onLogout,
    this.scanTruckQr,
  });
  final String name;
  final TripTracker tracker;
  final VoidCallback onLogout;
  final Future<String?> Function(BuildContext)? scanTruckQr;

  Future<String?> _scanTruck(BuildContext context) =>
      Navigator.of(context).push<String>(
        MaterialPageRoute(
          builder: (_) => const QrScanPage<String>(
            title: 'QR del camión',
            instructions:
                'Escanea el QR del camión para iniciar el viaje. '
                'Después enviaremos tu ubicación cada 5 segundos.',
            parse: parseTruckQr,
          ),
        ),
      );

  Future<void> _start(BuildContext context) async {
    final qrCode = await (scanTruckQr ?? _scanTruck)(context);
    if (qrCode == null || !context.mounted) return;
    await tracker.start(qrCode);
  }

  void _logout(BuildContext context) {
    if (tracker.status != TripStatus.idle && !tracker.sessionExpired) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Termina el viaje antes de cerrar sesión.'),
          ),
        );
      return;
    }
    onLogout();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: tracker,
    builder: (context, _) {
      final status = tracker.status;
      final blocked = tracker.sessionExpired;
      return Scaffold(
        backgroundColor: const Color(0xfff1f5f9),
        appBar: AppBar(
          title: const Text('Control vehicular'),
          backgroundColor: const Color(0xfff1f5f9),
          actions: [
            IconButton(
              onPressed: () => _logout(context),
              tooltip: 'Cerrar sesión',
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Hola, $name',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      tracker.trip == null
                          ? '¿Qué deseas hacer hoy?'
                          : 'Tienes un viaje en curso.',
                      style: const TextStyle(
                        color: Color(0xff526078),
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (blocked) ...[
                      _SessionExpiredCard(
                        pending: tracker.pendingCount,
                        onRelogin: onLogout,
                      ),
                      const SizedBox(height: 16),
                    ],
                    FilledButton.icon(
                      onPressed: status == TripStatus.idle && !blocked
                          ? () => _start(context)
                          : null,
                      style: _bigButton(
                        FilledButton.styleFrom(
                          backgroundColor: const Color(0xff4338ca),
                          foregroundColor: Colors.white,
                        ),
                      ),
                      icon: status == TripStatus.starting
                          ? const _ButtonSpinner(color: Colors.white)
                          : const Icon(Icons.play_circle_outline, size: 32),
                      label: Text(switch (status) {
                        TripStatus.starting => 'Iniciando viaje...',
                        TripStatus.idle => 'Iniciar viaje',
                        _ => 'Viaje en curso',
                      }, style: _bigLabel),
                    ),
                    if (tracker.trip != null) ...[
                      const SizedBox(height: 16),
                      _ActiveTripCard(tracker: tracker),
                    ],
                    if (tracker.error != null && !blocked) ...[
                      const SizedBox(height: 16),
                      _MessageCard(tracker.error!),
                    ],
                    const SizedBox(height: 18),
                    OutlinedButton.icon(
                      onPressed: status == TripStatus.active && !blocked
                          ? tracker.end
                          : null,
                      style: _bigButton(
                        OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xffb42318),
                          backgroundColor: Colors.white,
                          side: const BorderSide(color: Color(0xfff0b4ae)),
                        ),
                      ),
                      icon: status == TripStatus.ending
                          ? const _ButtonSpinner(color: Color(0xffb42318))
                          : const Icon(Icons.stop_circle_outlined, size: 32),
                      label: Text(
                        status == TripStatus.ending
                            ? 'Terminando viaje...'
                            : 'Terminar viaje',
                        style: _bigLabel,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Durante el viaje mantén la app abierta: la ubicación se envía cada 5 segundos.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Color(0xff526078)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

const _bigLabel = TextStyle(fontSize: 20, fontWeight: FontWeight.w600);

ButtonStyle _bigButton(ButtonStyle base) => base.copyWith(
  minimumSize: const WidgetStatePropertyAll(Size.fromHeight(88)),
  padding: const WidgetStatePropertyAll(
    EdgeInsets.symmetric(horizontal: 24, vertical: 24),
  ),
  shape: WidgetStatePropertyAll(
    RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
  ),
);

class _ButtonSpinner extends StatelessWidget {
  const _ButtonSpinner({required this.color});
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: 28,
    child: CircularProgressIndicator(color: color, strokeWidth: 3),
  );
}

String _elapsed(DateTime? since) {
  if (since == null) return '—';
  final d = DateTime.now().difference(since);
  String two(int n) => n.toString().padLeft(2, '0');
  final minutes =
      '${two(d.inMinutes.remainder(60))}:${two(d.inSeconds.remainder(60))}';
  return d.inHours > 0 ? '${d.inHours}:$minutes' : minutes;
}

class _ActiveTripCard extends StatelessWidget {
  const _ActiveTripCard({required this.tracker});
  final TripTracker tracker;

  @override
  Widget build(BuildContext context) {
    final trip = tracker.trip!;
    final position = tracker.lastPosition;
    final speed = tracker.speedKmh;
    return Card(
      elevation: 0,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.local_shipping_outlined,
                  color: Color(0xff4338ca),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    trip.model.isEmpty
                        ? trip.plate
                        : '${trip.plate} · ${trip.model}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text('Tiempo de viaje: ${_elapsed(tracker.startedAt)}'),
            Text(
              speed == null
                  ? 'Velocidad: calculando...'
                  : 'Velocidad (calculada por el servidor): ${speed.toStringAsFixed(speed < 10 ? 1 : 0)} km/h',
            ),
            if (position != null) ...[
              Text('Latitud: ${position.latitude.toStringAsFixed(6)}'),
              Text('Longitud: ${position.longitude.toStringAsFixed(6)}'),
              Text('Precisión: ± ${position.accuracy.round()} m'),
            ],
            const SizedBox(height: 12),
            Semantics(
              liveRegion: true,
              child: Row(
                children: [
                  Icon(
                    tracker.online
                        ? Icons.cloud_done_outlined
                        : Icons.cloud_off_outlined,
                    size: 18,
                    color: tracker.online
                        ? const Color(0xff027a48)
                        : const Color(0xffb54708),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      tracker.online
                          ? 'Conectado'
                          : 'Sin conexión · reintentando',
                    ),
                  ),
                ],
              ),
            ),
            Text(
              'Enviadas: ${tracker.sentCount} · Pendientes: ${tracker.pendingCount}',
            ),
            if (tracker.rejectedCount > 0)
              Text('Rechazadas por el servidor: ${tracker.rejectedCount}'),
            if (tracker.droppedCount > 0)
              Text(
                'Descartadas por falta de espacio: ${tracker.droppedCount}',
                style: const TextStyle(color: Color(0xffb42318)),
              ),
            if (tracker.notice != null) ...[
              const SizedBox(height: 8),
              Text(
                tracker.notice!,
                style: const TextStyle(color: Color(0xffb54708)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard(this.message);
  final String message;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: const Color(0xfffef3f2),
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Semantics(
        liveRegion: true,
        child: Text(message, style: const TextStyle(color: Color(0xffb42318))),
      ),
    ),
  );
}

class _SessionExpiredCard extends StatelessWidget {
  const _SessionExpiredCard({required this.pending, required this.onRelogin});
  final int pending;
  final VoidCallback onRelogin;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: const Color(0xfffef3f2),
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            liveRegion: true,
            child: Text(
              pending > 0
                  ? 'Tu sesión venció. Hay $pending ubicaciones sin enviar que se perderán al salir. '
                        'Vuelve a iniciar sesión y escanea el mismo camión para continuar el viaje.'
                  : 'Tu sesión venció. Vuelve a iniciar sesión y escanea el mismo camión para continuar el viaje.',
              style: const TextStyle(color: Color(0xffb42318)),
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onRelogin,
              child: const Text('Volver a iniciar sesión'),
            ),
          ),
        ],
      ),
    ),
  );
}
