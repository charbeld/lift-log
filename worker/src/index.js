// Lift Log API on Cloudflare: Google sign-in, workout sync (D1), and rest-timer push alarms
// (one Durable Object per user holds the pending alarm and sends a Web Push when it fires).
import { DurableObject } from 'cloudflare:workers';
import { sendPush, b64u } from './webpush.js';
import { verifyGoogleIdToken } from './google.js';

const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
});
const json = (env, data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(env) } });

async function sha256(s) {
  return b64u.enc(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

async function userFromToken(req, env) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const hash = await sha256(auth.slice(7));
  const row = await env.DB.prepare(
    'SELECT u.id, u.email, t.last_used FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?',
  ).bind(hash).first();
  if (!row) return null;
  if (Date.now() - row.last_used > 86400_000) {
    await env.DB.prepare('UPDATE auth_tokens SET last_used = ? WHERE token_hash = ?').bind(Date.now(), hash).run();
  }
  return { id: row.id, email: row.email, tokenHash: hash };
}

async function signIn(req, env) {
  const { idToken } = await req.json();
  let claims;
  try { claims = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID); } catch (e) { return json(env, { error: e.message }, 401); }
  const allowed = (env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(claims.email.toLowerCase())) return json(env, { error: 'This Google account is not allowed' }, 403);
  const token = b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email')
      .bind(claims.sub, claims.email, now),
    env.DB.prepare('INSERT INTO auth_tokens (token_hash, user_id, created_at, last_used) VALUES (?, ?, ?, ?)')
      .bind(await sha256(token), claims.sub, now, now),
  ]);
  return json(env, { token, email: claims.email });
}

// Push local changes (last write wins on client_updated_at), then return everything changed since `since`.
async function sync(req, env, user) {
  const body = await req.json();
  const now = Date.now();
  const stmts = [];
  for (const s of (body.workouts || []).slice(0, 500)) {
    if (!s?.id || typeof s.updatedAt !== 'number') continue;
    stmts.push(env.DB.prepare(
      `INSERT INTO workouts (user_id, id, data, deleted, client_updated_at, server_updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted,
         client_updated_at = excluded.client_updated_at, server_updated_at = excluded.server_updated_at
       WHERE excluded.client_updated_at > workouts.client_updated_at`,
    ).bind(user.id, String(s.id), JSON.stringify(s), s.deleted ? 1 : 0, s.updatedAt, now));
  }
  if (body.profile && typeof body.profile.updatedAt === 'number') {
    stmts.push(env.DB.prepare(
      `INSERT INTO profiles (user_id, program, settings, client_updated_at, server_updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET program = excluded.program, settings = excluded.settings,
         client_updated_at = excluded.client_updated_at, server_updated_at = excluded.server_updated_at
       WHERE excluded.client_updated_at > profiles.client_updated_at`,
    ).bind(user.id, JSON.stringify(body.profile.program), JSON.stringify(body.profile.settings), body.profile.updatedAt, now));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));

  const since = Math.max(0, Number(body.since) || 0);
  const { results } = await env.DB.prepare(
    'SELECT data, server_updated_at FROM workouts WHERE user_id = ? AND server_updated_at > ? ORDER BY server_updated_at',
  ).bind(user.id, since).all();
  const prof = await env.DB.prepare('SELECT program, settings, client_updated_at FROM profiles WHERE user_id = ?').bind(user.id).first();
  return json(env, {
    workouts: results.map((r) => JSON.parse(r.data)),
    cursor: results.reduce((m, r) => Math.max(m, r.server_updated_at), since),
    profile: prof ? { program: JSON.parse(prof.program), settings: JSON.parse(prof.settings), updatedAt: prof.client_updated_at } : null,
  });
}

async function schedule(req, env, user) {
  const { subscription, fireAt, title, body: text } = await req.json();
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return json(env, { error: 'bad subscription' }, 400);
  if (!/^https:\/\//.test(subscription.endpoint)) return json(env, { error: 'bad endpoint' }, 400);
  const at = Number(fireAt);
  if (!Number.isFinite(at) || at < Date.now() - 5000 || at > Date.now() + 30 * 60000) return json(env, { error: 'fireAt out of range' }, 400);
  await timerFor(env, user).schedule({
    subscription, fireAt: at, title: String(title || 'Rest over').slice(0, 80), body: String(text || '').slice(0, 160),
  });
  return json(env, { ok: true, fireAt: at });
}

const timerFor = (env, user) => env.TIMERS.get(env.TIMERS.idFromName(user.id));

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    const { pathname } = new URL(req.url);
    try {
      if (req.method === 'GET' && pathname === '/') return json(env, { ok: true, service: 'liftlog' });
      if (req.method !== 'POST') return json(env, { error: 'not found' }, 404);
      if (pathname === '/auth/google') return await signIn(req, env);
      const user = await userFromToken(req, env);
      if (!user) return json(env, { error: 'unauthorized' }, 401);
      switch (pathname) {
        case '/me': return json(env, { email: user.email });
        case '/sync': return await sync(req, env, user);
        case '/schedule': return await schedule(req, env, user);
        case '/cancel': await timerFor(env, user).cancel(); return json(env, { ok: true });
        case '/logout':
          await env.DB.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').bind(user.tokenHash).run();
          return json(env, { ok: true });
        default: return json(env, { error: 'not found' }, 404);
      }
    } catch (e) {
      console.log('error', pathname, e.stack || e);
      return json(env, { error: 'server error' }, 500);
    }
  },
};

export class RestTimer extends DurableObject {
  async schedule(job) {
    await this.ctx.storage.put('job', job);
    await this.ctx.storage.setAlarm(Math.max(job.fireAt, Date.now() + 50));
  }

  async cancel() {
    await this.ctx.storage.delete('job');
    await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const job = await this.ctx.storage.get('job');
    if (!job) return;
    await this.ctx.storage.delete('job');
    const vapid = { publicKey: this.env.VAPID_PUBLIC_KEY, privateJwk: JSON.parse(this.env.VAPID_PRIVATE_JWK), subject: this.env.VAPID_SUBJECT };
    const res = await sendPush(job.subscription, JSON.stringify({ title: job.title, body: job.body }), vapid);
    if (!res.ok) console.log('push failed', res.status, await res.text());
  }
}
