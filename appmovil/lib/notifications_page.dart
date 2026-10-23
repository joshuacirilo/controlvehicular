import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'core/assignments.dart';
import 'core/brand.dart';

/// Trips assigned to the pilot. Opening one marks it as read on the server.
class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key, required this.watcher});
  final AssignmentWatcher watcher;

  Future<void> _open(BuildContext context, TripAssignment assignment) {
    watcher.markRead(assignment);
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => AssignmentDetails(assignment: assignment),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Notificaciones')),
    body: ListenableBuilder(
      listenable: watcher,
      builder: (context, _) {
        final items = watcher.assignments;
        return RefreshIndicator(
          onRefresh: watcher.refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (watcher.error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    watcher.error!,
                    style: const TextStyle(color: Color(0xffb54708)),
                  ),
                ),
              if (!watcher.loaded && watcher.error == null)
                const Center(child: CircularProgressIndicator())
              else if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 48),
                  child: Text(
                    'No tienes viajes asignados.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: BrandColors.muted, fontSize: 16),
                  ),
                ),
              for (final item in items)
                Card(
                  elevation: 0,
                  color: item.read ? Colors.white : const Color(0xffe8f1ff),
                  child: ListTile(
                    leading: Icon(
                      item.read
                          ? Icons.local_shipping_outlined
                          : Icons.mark_email_unread_outlined,
                      color: BrandColors.blue,
                    ),
                    title: Text(
                      'Viaje asignado · ${item.plate}',
                      style: TextStyle(
                        fontWeight: item.read
                            ? FontWeight.w500
                            : FontWeight.bold,
                      ),
                    ),
                    subtitle: Text(
                      'Salida: ${formatSchedule(item.scheduledAt)}\n'
                      '${item.origin.label} → ${item.destination.label}',
                    ),
                    isThreeLine: true,
                    trailing: item.pending
                        ? null
                        : const Chip(label: Text('En curso')),
                    onTap: () => _open(context, item),
                  ),
                ),
            ],
          ),
        );
      },
    ),
  );
}

class AssignmentDetails extends StatelessWidget {
  const AssignmentDetails({super.key, required this.assignment});
  final TripAssignment assignment;

  @override
  Widget build(BuildContext context) {
    final a = assignment;
    Widget place(String label, AssignmentPlace place) => Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          if (place.name.isNotEmpty) Text(place.name),
          SelectableText(place.coordinates),
        ],
      ),
    );
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Viaje asignado',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              a.model.isEmpty
                  ? 'Camión ${a.plate}'
                  : 'Camión ${a.plate} · ${a.model}',
            ),
            Text('Salida: ${formatSchedule(a.scheduledAt)}'),
            place('Origen (A)', a.origin),
            place('Destino (B)', a.destination),
            if (a.note.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Nota', style: TextStyle(fontWeight: FontWeight.bold)),
              Text(a.note),
            ],
            const SizedBox(height: 16),
            Text(
              a.pending
                  ? 'Para empezar, pulsa "Iniciar viaje" y escanea el QR del camión ${a.plate}.'
                  : 'Este viaje está en curso.',
              style: const TextStyle(color: BrandColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}
