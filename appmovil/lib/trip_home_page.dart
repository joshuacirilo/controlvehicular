import 'dart:convert';

import 'package:flutter/services.dart';

import 'core/gps_quality.dart';

import 'package:flutter/material.dart';

import 'core/brand.dart';
import 'core/qr_credentials.dart';
import 'core/trip_tracker.dart';
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
  final Future<TruckCredentials?> Function(BuildContext)? scanTruckQr;

  Future<TruckCredentials?> _scanTruck(BuildContext context) =>
      Navigator.of(context).push<TruckCredentials>(
        MaterialPageRoute(
          builder: (_) => const QrScanPage<TruckCredentials>(
            title: 'QR del camión',
            instructions:
                'Escanea el QR del camión para iniciar el viaje. '
                'Guardaremos tu ubicación cada 5 segundos y la enviaremos por lotes cada minuto.',
            parse: TruckCredentials.parse,
          ),
        ),
      );

  Future<void> _start(BuildContext context) async {
    final truck = await (scanTruckQr ?? _scanTruck)(context);
    if (truck == null || !context.mounted) return;
    await tracker.start(truck);
  }

  bool get _canLogout =>
      tracker.status == TripStatus.idle || tracker.sessionExpired;

  Future<void> _sos(BuildContext context) async {
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('¿Enviar SOS?'),
      content: const Text('Avisaremos de una emergencia a tu central. Contacta también a emergencias o a tu central por teléfono. No esperes la confirmación del correo.'),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Enviar SOS'))],
    ));
    if (confirmed != true || !context.mounted) return;
    final recorded = await tracker.sendSos();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(recorded
      ? 'SOS registrado en la central. Contacta también por teléfono.'
      : 'No se confirmó el SOS. Contacta por teléfono y vuelve a intentarlo cuando tengas conexión.')));
  }

  /// The only way to end the session: it survives closing the app.
  Future<void> _logout(BuildContext context) async {
    if (!_canLogout) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Termina el viaje antes de cerrar sesión.'),
          ),
        );
      return;
    }
    final pending = tracker.pendingCount;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Cerrar sesión?'),
        content: Text(
          pending == 0
              ? 'Tendrás que ingresar de nuevo con tu usuario y contraseña.'
              : 'Hay $pending ubicaciones sin enviar. Quedarán guardadas en el '
                    'teléfono y se enviarán cuando vuelvas a iniciar sesión.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirmed == true && _canLogout) onLogout();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: tracker,
    builder: (context, _) {
      final status = tracker.status;
      final blocked = tracker.sessionExpired;
      return Scaffold(
        appBar: AppBar(
          title: const Row(
            children: [
              BrandMark(size: 32),
              SizedBox(width: 12),
              Text('Control vehicular'),
            ],
          ),
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
                        color: BrandColors.muted,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (blocked) ...[
                      _SessionExpiredCard(
                        pending: tracker.pendingCount,
                        persistent: tracker.persistent,
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
                          backgroundColor: BrandColors.blue,
                          foregroundColor: Colors.white,
                        ),
                      ),
                      icon: status == TripStatus.starting
                          ? const _ButtonSpinner(color: Colors.white)
                          : const Icon(Icons.play_circle_outline, size: 32),
                      label: Text(switch (status) {
                        TripStatus.starting => 'Buscando señal GPS...',
                        TripStatus.idle => 'Iniciar viaje',
                        _ => 'Viaje en curso',
                      }, style: _bigLabel),
                    ),
                    if (tracker.trip != null) ...[
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: !blocked && !tracker.sendingSos ? () => _sos(context) : null,
                        style: FilledButton.styleFrom(backgroundColor: Colors.red.shade800, foregroundColor: Colors.white),
                        icon: const Icon(Icons.sos),
                        label: Text(tracker.sendingSos ? 'Registrando SOS…' : 'SOS · Emergencia'),
                      ),
                      const SizedBox(height: 16),
                      _ActiveTripCard(tracker: tracker),
                    ] else if (tracker.pendingCount > 0 && !blocked) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Hay ${tracker.pendingCount} ubicaciones de un viaje anterior '
                        'guardadas en el teléfono. Se enviarán en cuanto haya conexión.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: BrandColors.muted),
                      ),
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
                    Text(
                      tracker.tracksInBackground
                          ? 'Puedes usar otras apps, apagar la pantalla o cerrar la app: el viaje se sigue '
                                'registrando cada 5 segundos hasta que pulses "Terminar viaje".'
                          : 'Durante el viaje mantén la app abierta: la ubicación se envía cada 5 segundos. '
                                'Si la cierras, al volver a abrirla el viaje continúa.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 13,
                        color: BrandColors.muted,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Divider(),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _canLogout ? () => _logout(context) : null,
                      icon: const Icon(Icons.logout),
                      label: const Text('Cerrar sesión'),
                    ),
                    if (!_canLogout) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'Termina el viaje para poder cerrar sesión.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: BrandColors.muted,
                        ),
                      ),
                    ],
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
                  color: BrandColors.blue,
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
              Text(
                'Señal GPS: ${isFreshPosition(position, DateTime.now()) ? gpsQualityLabel(position.accuracy) : "Baja · ubicación antigua"}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color:
                      !isFreshPosition(position, DateTime.now()) ||
                          gpsQuality(position.accuracy) == GpsQuality.poor
                      ? const Color(0xffb42318)
                      : gpsQuality(position.accuracy) == GpsQuality.fair
                      ? const Color(0xff92400e)
                      : const Color(0xff027a48),
                ),
              ),
              Text('Latitud: ${position.latitude.toStringAsFixed(6)}'),
              Text('Longitud: ${position.longitude.toStringAsFixed(6)}'),
              Text('Precisión: ± ${position.accuracy.round()} m'),
            ],
            ExpansionTile(
              title: const Text('Diagnóstico GPS'),
              children: [
                Text('Muestras dudosas: ${tracker.questionableSamples}'),
                Text(
                  'Último intervalo: ${tracker.lastSampleIntervalSeconds?.toStringAsFixed(1) ?? "—"} s · Mayor intervalo: ${tracker.maxSampleGapSeconds.toStringAsFixed(1)} s',
                ),
                const Text(
                  'Registro de esta sesión: últimas 360 muestras. El estado indica si la app estaba visible o en segundo plano; no mide directamente la pantalla.',
                ),
                TextButton.icon(
                  icon: const Icon(Icons.copy),
                  label: const Text('Copiar diagnóstico'),
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(
                        text: const JsonEncoder.withIndent('  ').convert({
                          'tripId': trip.id,
                          'sampleIntervalSeconds': tracker.interval.inSeconds,
                          'uploadIntervalSeconds':
                              tracker.uploadInterval.inSeconds,
                          'samples': tracker.gpsDiagnostics,
                        }),
                      ),
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Diagnóstico copiado.')),
                      );
                    }
                  },
                ),
              ],
            ),
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
                          : tracker.persistent
                          ? 'Sin conexión · guardando en el teléfono'
                          : 'Sin conexión · reintentando',
                    ),
                  ),
                ],
              ),
            ),
            Text(
              'Enviadas: ${tracker.sentCount} · Pendientes: ${tracker.pendingCount}',
            ),
            Text(
              'Captura cada ${tracker.interval.inSeconds} s · Envío por lotes cada ${tracker.uploadInterval.inSeconds} s.',
            ),
            if (tracker.rejectedCount > 0)
              Text('Rechazadas por el servidor: ${tracker.rejectedCount}'),
            if (tracker.droppedCount > 0)
              Text(
                'Descartadas por falta de espacio o antigüedad: ${tracker.droppedCount}',
                style: const TextStyle(color: Color(0xffb42318)),
              ),
            if (!tracker.persistent)
              const Text(
                'Este dispositivo no puede guardar ubicaciones: '
                'las pendientes se perderán si cierras la app.',
                style: TextStyle(color: Color(0xffb54708)),
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
  const _SessionExpiredCard({
    required this.pending,
    required this.persistent,
    required this.onRelogin,
  });
  final int pending;
  final bool persistent;
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
              pending == 0
                  ? 'Tu sesión fue cerrada (desde otro dispositivo, o tu usuario fue desactivado). '
                        'Vuelve a iniciar sesión: si tenías un viaje en curso, continuará solo.'
                  : persistent
                  ? 'Tu sesión fue cerrada. Hay $pending ubicaciones guardadas en el teléfono que se enviarán '
                        'cuando vuelvas a iniciar sesión; si tenías un viaje en curso, continuará solo.'
                  : 'Tu sesión fue cerrada. Hay $pending ubicaciones sin enviar que se perderán al salir. '
                        'Vuelve a iniciar sesión: si tenías un viaje en curso, continuará solo.',
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
