import 'dart:convert';

class QrCredentials {
  const QrCredentials(this.username, this.password);
  final String username;
  final String password;

  static QrCredentials parse(String raw) {
    // Only accept credential JSON, never URLs or executable content.
    if (raw.length > 2048) throw const FormatException('QR no compatible.');
    dynamic data;
    try {
      data = jsonDecode(raw);
    } catch (_) {
      throw const FormatException(
        'El QR debe contener username y password en JSON.',
      );
    }
    if (data is! Map ||
        data['username'] is! String ||
        data['password'] is! String) {
      throw const FormatException(
        'El QR debe contener username y password como texto.',
      );
    }
    final username = (data['username'] as String).trim();
    final password = data['password'] as String;
    if (username.isEmpty ||
        username.length > 80 ||
        password.isEmpty ||
        password.length > 128) {
      throw const FormatException('Las credenciales del QR no son válidas.');
    }
    return QrCredentials(username, password);
  }
}
