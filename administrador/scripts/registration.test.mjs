import assert from 'node:assert/strict';
import test from 'node:test';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { parseRegistration, registrationQr } from '../lib/registration.ts';

const truck = { kind: 'truck', placa: ' p123abc ', modelo: 'Camión', password: 'QR-test-123!' };
const pilot = { kind: 'pilot', username: ' Piloto.Test ', nombre: 'Piloto de prueba', licencia: 'abc-12', telefono: '+502 5555 1234', password: 'QR-test-123!' };

test('normalizes identifiers without changing passwords', () => {
  const t = parseRegistration(truck);
  const p = parseRegistration(pilot);
  assert.equal(t.value.placa, 'P123ABC');
  assert.equal(p.value.username, 'piloto.test');
  assert.equal(p.value.licencia, 'ABC-12');
  assert.equal(t.value.password, truck.password);
});
test('rejects invalid and incomplete records before writing', () => {
  for (const value of [null, [], {}, { ...truck, placa: '<script>' }, { ...truck, password: '123' },
    { ...pilot, username: '$bad' }, { ...pilot, licencia: '' }, { ...pilot, telefono: '-------' },
    { ...truck, password: 'x'.repeat(129) }, { ...pilot, nombre: '' }]) {
    assert.equal(parseRegistration(value).ok, false);
  }
});
test('ignores injected roles and activity fields', () => {
  const result = parseRegistration({ ...pilot, rol: 'administrador', activo: false });
  assert.equal(result.ok, true);
  assert.equal('rol' in result.value, false);
  assert.equal('activo' in result.value, false);
});
test('PNG codes decode to exactly the Flutter credential contracts, including special characters', async () => {
  for (const value of [truck, pilot]) {
    const parsed = parseRegistration({ ...value, password: 'Contraseña:"á&<>123' });
    const payload = registrationQr(parsed.value);
    const png = PNG.sync.read(await QRCode.toBuffer(payload, {
      width: 768, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#01215a', light: '#ffffff' },
    }));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded?.data, payload);
    const credentials = JSON.parse(decoded.data);
    assert.deepEqual(Object.keys(credentials).sort(), [value.kind === 'truck' ? 'placa' : 'username', 'password'].sort());
    assert.equal(credentials.password, parsed.value.password);
  }
});
