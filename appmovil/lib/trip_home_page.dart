import 'package:flutter/material.dart';

class TripHomePage extends StatelessWidget {
  const TripHomePage({super.key, required this.name, required this.onLogout});
  final String name;
  final VoidCallback onLogout;

  void _preview(BuildContext context) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text(
            'Próximamente. Esta opción todavía no registra viajes.',
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xfff1f5f9),
    appBar: AppBar(
      title: const Text('Control vehicular'),
      backgroundColor: const Color(0xfff1f5f9),
      actions: [
        IconButton(
          onPressed: onLogout,
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
                const Text(
                  '¿Qué deseas hacer hoy?',
                  style: TextStyle(color: Color(0xff526078), fontSize: 16),
                ),
                const SizedBox(height: 32),
                FilledButton.icon(
                  onPressed: () => _preview(context),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xff4338ca),
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(88),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 24,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  icon: const Icon(Icons.play_circle_outline, size: 32),
                  label: const Text(
                    'Iniciar viaje',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(height: 18),
                OutlinedButton.icon(
                  onPressed: () => _preview(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xffb42318),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: Color(0xfff0b4ae)),
                    minimumSize: const Size.fromHeight(88),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 24,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  icon: const Icon(Icons.stop_circle_outlined, size: 32),
                  label: const Text(
                    'Terminar viaje',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Vista de prueba · Las acciones estarán disponibles próximamente.',
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
}
