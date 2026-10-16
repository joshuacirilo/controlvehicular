import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'core/qr_credentials.dart';
import 'qr_login_page.dart';
import 'trip_home_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.api, this.scanQr});
  final Future<QrCredentials?> Function(BuildContext)? scanQr;
  final ApiClient? api;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _form = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  ApiClient? _api;
  bool _busy = false, _visible = false;
  bool _scanning = false;
  String? _error, _name;
  @override
  void initState() {
    super.initState();
    try {
      _api = widget.api ?? ApiClient();
    } catch (_) {
      _error = 'Falta configurar una dirección válida del servidor.';
    }
  }

  Future<void> _login() async {
    if (_busy || _api == null || !_form.currentState!.validate()) return;
    await _authenticate(_username.text, _password.text);
  }

  Future<void> _scanQr() async {
    if (_busy || _scanning || _api == null) return;
    setState(() {
      _scanning = true;
      _error = null;
    });
    try {
      final credentials =
          await (widget.scanQr?.call(context) ??
              Navigator.of(context).push<QrCredentials>(
                MaterialPageRoute(builder: (_) => const QrLoginPage()),
              ));
      if (!mounted || credentials == null) return;
      await _authenticate(credentials.username, credentials.password);
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  Future<void> _authenticate(String username, String password) async {
    if (_busy || _api == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final name = await _api!.login(username, password);
      if (!mounted) return;
      _password.clear();
      if (mounted) setState(() => _name = name);
    } on LoginException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(
          () =>
              _error = 'No se pudo conectar con el servidor. Intenta de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    if (widget.api == null) _api?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _name != null
      ? TripHomePage(
          name: _name!,
          onLogout: () => setState(() {
            _name = null;
            _error = null;
            _visible = false;
            _username.clear();
            _password.clear();
          }),
        )
      : Scaffold(
          backgroundColor: const Color(0xfff1f5f9),
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Card(
                    elevation: 0,
                    color: Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Align(
                            alignment: Alignment.centerLeft,
                            child: CircleAvatar(
                              backgroundColor: Color(0xff4338ca),
                              foregroundColor: Colors.white,
                              child: Icon(Icons.local_shipping_outlined),
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'CONTROL VEHICULAR',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Entorno de prueba',
                            style: TextStyle(color: Color(0xff4338ca)),
                          ),
                          const SizedBox(height: 24),

                          Text(
                            'Bienvenido',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          const SizedBox(height: 8),
                          const Text('Ingresa para probar el acceso a la app.'),
                          const SizedBox(height: 24),
                          Form(
                            key: _form,
                            child: AutofillGroup(
                              child: Column(
                                children: [
                                  TextFormField(
                                    controller: _username,
                                    enabled: !_busy,
                                    decoration: const InputDecoration(
                                      labelText: 'Usuario',
                                      border: OutlineInputBorder(),
                                      prefixIcon: Icon(Icons.person_outline),
                                    ),
                                    autofillHints: const [
                                      AutofillHints.username,
                                    ],
                                    textInputAction: TextInputAction.next,
                                    autocorrect: false,
                                    validator: (v) =>
                                        v == null || v.trim().isEmpty
                                        ? 'Ingresa tu usuario'
                                        : v.length > 80
                                        ? 'Usuario demasiado largo'
                                        : null,
                                  ),
                                  const SizedBox(height: 18),
                                  TextFormField(
                                    controller: _password,
                                    enabled: !_busy,
                                    obscureText: !_visible,
                                    decoration: InputDecoration(
                                      labelText: 'Contraseña',
                                      border: const OutlineInputBorder(),
                                      suffixIcon: IconButton(
                                        tooltip: _visible
                                            ? 'Ocultar contraseña'
                                            : 'Mostrar contraseña',
                                        onPressed: () => setState(
                                          () => _visible = !_visible,
                                        ),
                                        icon: Icon(
                                          _visible
                                              ? Icons.visibility_off_outlined
                                              : Icons.visibility_outlined,
                                        ),
                                      ),
                                    ),
                                    autofillHints: const [
                                      AutofillHints.password,
                                    ],
                                    textInputAction: TextInputAction.done,
                                    autocorrect: false,
                                    enableSuggestions: false,
                                    onFieldSubmitted: (_) => _login(),
                                    validator: (v) => v == null || v.isEmpty
                                        ? 'Ingresa tu contraseña'
                                        : v.length > 128
                                        ? 'Contraseña demasiado larga'
                                        : null,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (_error != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 16),
                              child: Semantics(
                                liveRegion: true,
                                child: Text(
                                  _error!,
                                  style: const TextStyle(
                                    color: Color(0xffb42318),
                                  ),
                                ),
                              ),
                            ),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: _busy || _scanning || _api == null
                                ? null
                                : _login,
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Text(_busy ? 'Conectando...' : 'Ingresar'),
                            ),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: _busy || _scanning || _api == null
                                ? null
                                : _scanQr,
                            icon: const Icon(Icons.qr_code_scanner),
                            label: const Text('Ingresar con QR'),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Acceso temporal con usuarios de prueba. No requiere conexión con Atlas.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xff526078),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
}
