import 'dart:convert';

const _passwordLabels = {'contraseña', 'contrasena', 'password', 'clave'};

/// Reads an identifier and a password from JSON (the identifier under
/// [jsonKey] plus `password`) or labeled text (one of [labels] and
/// `Contraseña:`), either on separate lines or both on a single line. Unknown
/// labels are rejected, so a user QR never parses as a truck QR and vice versa.
(String, String) _parseCredentials(
  String raw, {
  required Set<String> labels,
  required String jsonKey,
  required String labeledError,
  required String jsonError,
}) {
  // Only accept credential data, never URLs or executable content.
  if (raw.length > 2048) throw const FormatException('QR no compatible.');
  final text = raw.trim();
  if (text.startsWith('{')) {
    dynamic data;
    try {
      data = jsonDecode(text);
    } catch (_) {
      throw const FormatException('El QR no contiene credenciales legibles.');
    }
    if (data is! Map ||
        data[jsonKey] is! String ||
        data['password'] is! String) {
      throw FormatException(jsonError);
    }
    return (data[jsonKey] as String, data['password'] as String);
  }
  final lines = text
      .split(RegExp(r'\r?\n'))
      .where((line) => line.trim().isNotEmpty)
      .toList();
  final entries = lines.length == 1
      ? _inlineEntries(lines.single, {...labels, ..._passwordLabels})
      : [for (final line in lines) _lineEntry(line)];
  String? id, password;
  for (final entry in entries) {
    if (entry == null) throw FormatException(labeledError);
    final (label, value) = entry;
    if (labels.contains(label) && id == null) {
      id = value;
    } else if (_passwordLabels.contains(label) && password == null) {
      password = value;
    } else {
      throw FormatException(labeledError);
    }
  }
  if (id == null || password == null) throw FormatException(labeledError);
  return (id, password);
}

(String, String)? _lineEntry(String line) {
  final separator = line.indexOf(RegExp('[:=]'));
  if (separator <= 0) return null;
  return (
    line.substring(0, separator).trim().toLowerCase(),
    line.substring(separator + 1).trim(),
  );
}

/// Splits `Placa: X Contraseña: Y` at each known label, so a value cannot
/// contain a known label preceded by a space.
List<(String, String)?> _inlineEntries(String line, Set<String> known) {
  final pattern = RegExp(
    '(?:^|\\s)(${known.map(RegExp.escape).join('|')})\\s*[:=]',
    caseSensitive: false,
    unicode: true,
  );
  final matches = pattern.allMatches(line).toList();
  if (matches.isEmpty ||
      line.substring(0, matches.first.start).trim().isNotEmpty) {
    return [null];
  }
  return [
    for (var i = 0; i < matches.length; i++)
      (
        matches[i].group(1)!.toLowerCase(),
        line
            .substring(
              matches[i].end,
              i + 1 < matches.length ? matches[i + 1].start : line.length,
            )
            .trim(),
      ),
  ];
}

/// Pilot account credentials from a login QR.
class QrCredentials {
  const QrCredentials(this.username, this.password);
  final String username;
  final String password;

  static QrCredentials parse(String raw) {
    final (username, password) = _parseCredentials(
      raw,
      labels: const {'usuario', 'username', 'user'},
      jsonKey: 'username',
      labeledError:
          'El QR debe contener "Usuario:" y "Contraseña:" en líneas separadas.',
      jsonError: 'El QR debe contener usuario y contraseña como texto.',
    );
    final trimmed = username.trim();
    if (trimmed.isEmpty ||
        trimmed.length > 80 ||
        password.isEmpty ||
        password.length > 128) {
      throw const FormatException('Las credenciales del QR no son válidas.');
    }
    return QrCredentials(trimmed, password);
  }
}

/// Plate and password printed on a truck QR, required to start every trip.
class TruckCredentials {
  const TruckCredentials(this.plate, this.password);
  final String plate;
  final String password;

  static TruckCredentials parse(String raw) {
    final (plate, password) = _parseCredentials(
      raw,
      labels: const {'placa', 'plate'},
      jsonKey: 'placa',
      labeledError:
          'Este QR no es de un camión: debe contener "Placa:" y "Contraseña:".',
      jsonError:
          'El QR del camión debe contener placa y contraseña como texto.',
    );
    final normalized = plate.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9-]{1,20}$').hasMatch(normalized) ||
        password.isEmpty ||
        password.length > 128) {
      throw const FormatException(
        'Las credenciales del camión no son válidas.',
      );
    }
    return TruckCredentials(normalized, password);
  }
}
