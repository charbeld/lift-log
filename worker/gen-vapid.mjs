// Generates a VAPID key pair: private JWK -> .vapid-private.json (never commit), public key printed.
import { writeFileSync, existsSync } from 'node:fs';
const { subtle } = globalThis.crypto;
if (existsSync('.vapid-private.json')) { console.error('.vapid-private.json exists; delete it to rotate keys'); process.exit(1); }
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await subtle.exportKey('jwk', kp.privateKey);
const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
const pub = Buffer.from(raw).toString('base64url');
writeFileSync('.vapid-private.json', JSON.stringify({ kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y }));
writeFileSync('.vapid-public.txt', pub);
console.log(pub);
