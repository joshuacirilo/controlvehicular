import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import 'core/api_client.dart';
import 'core/brand.dart';
import 'core/location_service.dart';
import 'core/ping_store.dart';
import 'core/qr_credentials.dart';
import 'core/session_store.dart';
import 'core/trip_tracker.dart';
import 'qr_scan_page.dart';
import 'trip_home_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    this.api,
    this.scanQr,
    this.store,
    this.sessionStore,
    this.locate,
    this.watch,
  });
  final Future<QrCredentials?> Function(BuildContext)? scanQr;
  final ApiClient? api;

  /// Queue for location samples; the device database when null.
  final PingStore? store;

  /// Saved session and trip; the platform's secure storage when null.
  final SessionStore? sessionStore;

  /// Location sources for tests; the device GPS when null.
  final Future<Position> Function()? locate;
  final Stream<Position> Function()? watch;
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
  bool _restoring = true;
  String? _error;
  AuthSession? _session;
  TripTracker? _tracker;
  late final Future<PingStore> _store;
  late final SessionStore _sessions;
  @override
  void initState() {
    super.initState();
    _store = widget.store != null
        ? Future.value(widget.store!)
        : openPingStore();
    _sessions = widget.sessionStore ?? SecureSessionStore();
    try {
      _api = widget.api ?? ApiClient();
    } catch (_) {
      _error = 'Falta configurar una dirección válida del servidor.';
    }
    _restoreSession();
  }

  /// The session survives app restarts: only an explicit logout ends it.
  Future<void> _restoreSession() async {
    try {
      final session = _api == null ? null : await _sessions.read();
      if (session != null && mounted) await _open(session);
    } catch (_) {
      // Without a readable session the pilot signs in again.
    } finally {
      if (mounted) setState(() => _restoring = false);
    }
  }

  Future<void> _open(AuthSession session) async {
    final store = await _store;
    if (!mounted) return;
    final tracker = TripTracker(
      api: _api!,
      token: session.token,
      userId: session.userId,
      store: store,
      sessionStore: _sessions,
      locate: widget.locate,
      watch:
          widget.watch ??
          (backgroundTrackingSupported ? backgroundLocationUpdates : null),
    );
    setState(() {
      _session = session;
      _tracker = tracker;
    });
    unawaited(tracker.resumeActiveTrip());
  }

  Future<void> _logout() async {
    final session = _session;
    _tracker?.dispose();
    setState(() {
      _tracker = null;
      _session = null;
      _error = null;
      _visible = false;
      _username.clear();
      _password.clear();
    });
    try {
      await _sessions.clear();
    } catch (_) {}
    // Best effort: without connection the token stays valid on the server
    // but is no longer on the device.
    if (session != null) {
      unawaited(_api?.logout(session.token).catchError((_) {}));
    }
  }

  Future<void> _login() async {
    if (_busy || _api == null || !_form.currentState!.validate()) return;
    await _authenticate(() => _api!.login(_username.text, _password.text));
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
                MaterialPageRoute(
                  builder: (_) => const QrScanPage<QrCredentials>(
                    title: 'Ingresar con QR',
                    instructions:
                        'Coloca tu QR de usuario dentro del recuadro. '
                        'Validaremos tus credenciales con el servidor.',
                    parse: QrCredentials.parse,
                  ),
                ),
              ));
      if (!mounted || credentials == null) return;
      await _authenticate(
        () => _api!.login(credentials.username, credentials.password),
      );
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  Future<void> _authenticate(Future<AuthSession> Function() login) async {
    if (_busy || _api == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await login();
      try {
        await _sessions.save(session);
      } catch (_) {
        // The session still works now; it just will not survive a restart.
      }
      if (!mounted) return;
      _password.clear();
      await _open(session);
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
    _tracker?.dispose();
    _username.dispose();
    _password.dispose();
    if (widget.api == null) _api?.close();
    if (widget.store == null) _store.then((store) => store.close());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _session != null && _tracker != null
      ? TripHomePage(
          name: _session!.name,
          tracker: _tracker!,
          onLogout: _logout,
        )
      : _restoring
      ? const Scaffold(
          backgroundColor: BrandColors.navy,
          body: Center(child: CircularProgressIndicator(color: Colors.white)),
        )
      : Scaffold(
          backgroundColor: BrandColors.navy,
          body: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.topCenter,
                radius: 1.4,
                colors: [
                  Color(0xff0b5fd6),
                  BrandColors.navyLight,
                  BrandColors.navy,
                ],
                stops: [0, 0.45, 1],
              ),
            ),
            child: SafeArea(
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
                              child: BrandMark(),
                            ),
                            const SizedBox(height: 20),
                            const Text(
                              'CONTROL VEHICULAR',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                                fontSize: 12,
                                color: BrandColors.blue,
                              ),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              'Bienvenido',
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                            const SizedBox(height: 8),
                            const Text('Ingresa con tu usuario de piloto.'),
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
                                child: Text(
                                  _busy ? 'Conectando...' : 'Ingresar',
                                ),
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
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
}
