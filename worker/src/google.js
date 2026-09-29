// Verify a Google ID token (RS256) against Google's published keys.
import { b64u } from './webpush.js';

let jwksCache = { at: 0, keys: [] };

async function googleKeys() {
  if (Date.now() - jwksCache.at < 3600_000 && jwksCache.keys.length) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('could not fetch Google keys');
  jwksCache = { at: Date.now(), keys: (await res.json()).keys };
  return jwksCache.keys;
}

const dec = (part) => JSON.parse(new TextDecoder().decode(b64u.dec(part)));

export async function verifyGoogleIdToken(token, clientId) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [h, p, s] = parts;
  const header = dec(h), claims = dec(p);
  if (header.alg !== 'RS256') throw new Error('bad alg');
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) { jwksCache.at = 0; jwk = (await googleKeys()).find((k) => k.kid === header.kid); }
  if (!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.dec(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('bad signature');
  const now = Date.now() / 1000;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw new Error('bad issuer');
  if (claims.aud !== clientId) throw new Error('bad audience');
  if (!(claims.exp > now - 60)) throw new Error('token expired');
  if (!claims.email || claims.email_verified === false || claims.email_verified === 'false') throw new Error('email not verified');
  return claims;
}
