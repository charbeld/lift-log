// Lift Log push scheduler: one Durable Object per user holds the pending rest-timer alarm
// and sends a Web Push to the phone when it fires.
import { DurableObject } from 'cloudflare:workers';
import { sendPush } from './webpush.js';

const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
});
const json = (env, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(env) } });

// Verify the Supabase access token by asking Supabase who it belongs to.
async function userFromToken(req, env) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization: auth, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  const allowed = (env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes((user.email || '').toLowerCase())) return null;
  return user;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') return json(env, { ok: true, service: 'liftlog-push' });
    if (req.method !== 'POST' || !['/schedule', '/cancel'].includes(url.pathname)) return json(env, { error: 'not found' }, 404);

    const user = await userFromToken(req, env);
    if (!user) return json(env, { error: 'unauthorized' }, 401);
    let body = {};
    try { body = await req.json(); } catch {}
    const stub = env.TIMERS.get(env.TIMERS.idFromName(user.id));

    if (url.pathname === '/cancel') { await stub.cancel(); return json(env, { ok: true }); }

    const { subscription, fireAt, title, body: text } = body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return json(env, { error: 'bad subscription' }, 400);
    if (!/^https:\/\//.test(subscription.endpoint)) return json(env, { error: 'bad endpoint' }, 400);
    const at = Number(fireAt);
    if (!Number.isFinite(at) || at < Date.now() - 5000 || at > Date.now() + 30 * 60000) return json(env, { error: 'fireAt out of range' }, 400);
    await stub.schedule({ subscription, fireAt: at, title: String(title || 'Rest over').slice(0, 80), body: String(text || '').slice(0, 160) });
    return json(env, { ok: true, fireAt: at });
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
