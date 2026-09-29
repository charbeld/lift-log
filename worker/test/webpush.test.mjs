// Round-trip check: encrypt with our Worker code, decrypt with the reference `http_ece` library
// (the one the `web-push` npm package uses), and verify the VAPID JWT signature.
// Run: npm i --no-save http_ece && node test/webpush.test.mjs
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ece from 'http_ece';
import { encryptPayload, vapidAuth, b64u } from '../src/webpush.js';

const ua = crypto.createECDH('prime256v1');
ua.generateKeys();
const auth = crypto.randomBytes(16);
const sub = {
  endpoint: 'https://web.push.apple.com/QExample',
  keys: { p256dh: b64u.enc(ua.getPublicKey()), auth: b64u.enc(auth) },
};

const msg = JSON.stringify({ title: 'Rest over', body: 'Next: Leg Press · set 2 💪' });
const body = await encryptPayload(sub, msg);
const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret: auth });
assert.equal(plain.toString('utf8'), msg);
console.log('payload round-trip OK (%d bytes)', body.length);

const kp = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.webcrypto.subtle.exportKey('jwk', kp.privateKey);
const pub = b64u.enc(await crypto.webcrypto.subtle.exportKey('raw', kp.publicKey));
const header = await vapidAuth(sub.endpoint, { privateJwk: jwk, publicKey: pub, subject: 'mailto:test@example.com' });
const [, t, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
assert.equal(k, pub);
const [h, c, s] = t.split('.');
const ok = await crypto.webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64u.dec(s), new TextEncoder().encode(`${h}.${c}`));
assert.ok(ok, 'VAPID signature verifies');
const claims = JSON.parse(Buffer.from(b64u.dec(c)).toString());
assert.equal(claims.aud, 'https://web.push.apple.com');
console.log('VAPID JWT OK', claims);
