import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'login_page.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Control vehicular',
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
    ),
    home: const LoginPage(),
  );
}

class ConnectionPage extends StatefulWidget {
  const ConnectionPage({super.key, this.api});
  final ApiClient? api;
  @override
  State<ConnectionPage> createState() => _ConnectionPageState();
}

class _ConnectionPageState extends State<ConnectionPage> {
  ApiClient? _api;
  bool _loading = false;
  String _message = 'Sin comprobar';
  @override
  void initState() {
    super.initState();
    try {
      _api = widget.api ?? ApiClient();
      _check();
    } on StateError {
      _message = 'Falta configurar una direccion valida del servidor.';
    }
  }

  Future<void> _check() async {
    setState(() {
      _loading = true;
      _message = 'Conectando...';
    });
    try {
      await _api!.checkConnection();
      if (mounted) {
        setState(() => _message = 'Conexion con el servidor establecida');
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _message = 'No se pudo conectar. Comprueba que el servidor este encendido e intenta de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    if (widget.api == null) _api?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Control vehicular')),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_loading) const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(_message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loading || _api == null ? null : _check,
              child: const Text('Comprobar conexion'),
            ),
          ],
        ),
      ),
    ),
  );
}
