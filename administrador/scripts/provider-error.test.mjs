import assert from 'node:assert/strict';
import { test } from 'node:test';
import { providerError } from '../server/notifications/provider-error.ts';

test('classifies provider rejections without returning provider text, keys or recipients', async () => {
  for (const [body, code] of [
    ['API calls are disabled for non-browser applications', 'non_browser_disabled'],
    ['The private key is invalid', 'private_key'],
    ['Invalid accessToken', 'private_key'],
    ['The public key is invalid', 'public_key'],
    ['Origin is not allowed', 'origin_restricted'],
    ['reCAPTCHA validation failed', 'captcha'],
    ['Template not found', 'template'],
    ['Service unavailable', 'service'],
    ['Forbidden', 'forbidden_unknown'],
  ]) {
    const result = await providerError(new Response(`${body} SECRET_VALUE recipient@example.invalid`, { status: 403 }));
    assert.equal(result.code, code);
    assert.equal(JSON.stringify(result).includes('SECRET_VALUE'), false);
    assert.equal(JSON.stringify(result).includes('recipient@example.invalid'), false);
  }
});

test('bounds response processing and handles missing or failing bodies', async () => {
  assert.equal((await providerError(new Response('x'.repeat(5000) + 'private key', { status: 403 }))).code, 'forbidden_unknown');
  assert.equal((await providerError(new Response(null, { status: 403 }))).code, 'forbidden_unknown');
  assert.equal((await providerError(new Response('private key', { status: 429 }))).code, 'rate_limit');
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('SECRET')); } });
  assert.equal((await providerError(new Response(stream, { status: 502 }))).code, 'provider_unknown');
});
