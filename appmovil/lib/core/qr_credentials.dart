import 'dart:convert';

class QrCredentials {
  const QrCredentials(this.username, this.password);
  final String username;
  final String password;

  static const _usernameLabels = {'usuario', 'username', 'user'};
  static const _passwordLabels = {
    'contraseña',
    'contrasena',
    'password',
    'clave',
  };

  /// Accepts JSON (`{"username": "...", "password": "..."}`) or labeled text
  /// lines (`Usuario: ...` and `Contraseña: ...`).
  static QrCredentials parse(String raw) {
    // Only accept credential data, never URLs or executable content.
    if (raw.length > 2048) throw const FormatException('QR no compatible.');
    final text = raw.trim();
    final (username, password) = text.startsWith('{')
        ? _parseJson(text)
        : _parseLabeled(text);
    final trimmed = username.trim();
    if (trimmed.isEmpty ||
        trimmed.length > 80 ||
        password.isEmpty ||
        password.length > 128) {
      throw const FormatException('Las credenciales del QR no son válidas.');
    }
    return QrCredentials(trimmed, password);
  }

  static (String, String) _parseJson(String text) {
    dynamic data;
    try {
      data = jsonDecode(text);
    } catch (_) {
      throw const FormatException('El QR no contiene credenciales legibles.');
    }
    if (data is! Map ||
        data['username'] is! String ||
        data['password'] is! String) {
      throw const FormatException(
        'El QR debe contener usuario y contraseña como texto.',
      );
    }
    return (data['username'] as String, data['password'] as String);
  }

  static (String, String) _parseLabeled(String text) {
    String? username, password;
    for (final line in text.split(RegExp(r'\r?\n'))) {
      if (line.trim().isEmpty) continue;
      final separator = line.indexOf(RegExp('[:=]'));
      if (separator <= 0) throw _labeledError;
      final label = line.substring(0, separator).trim().toLowerCase();
      final value = line.substring(separator + 1).trim();
      if (_usernameLabels.contains(label) && username == null) {
        username = value;
      } else if (_passwordLabels.contains(label) && password == null) {
        password = value;
      } else {
        throw _labeledError;
      }
    }
    if (username == null || password == null) throw _labeledError;
    return (username, password);
  }

  static const _labeledError = FormatException(
    'El QR debe contener "Usuario:" y "Contraseña:" en líneas separadas.',
  );
}
