/// Validates the code printed on a truck QR (for example `TRUCK-DEMO-001`).
/// The server decides whether it belongs to an active truck.
String parseTruckQr(String raw) {
  final code = raw.trim();
  if (!RegExp(r'^[A-Za-z0-9_-]{1,200}$').hasMatch(code)) {
    throw const FormatException('Este QR no corresponde a un camión.');
  }
  return code;
}
