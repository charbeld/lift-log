// Google sign-in + two-way sync with the Lift Log Worker (Cloudflare D1).
// Local state is the source of truth; last write wins per workout (and for the program).
import CONFIG from './config.js';
import { state, commit, save } from './store.js';

const NONCE_KEY = 'liftlog:nonce';
let running = null;
let timer = null;
export const status = { enabled: !!(CONFIG.apiUrl && CONFIG.googleClientId), busy: false, error: null };

const api = (path) => CONFIG.apiUrl.replace(/\/$/, '') + path;
export const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');

async function post(path, body, token = state.sync.token) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(api(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) { dropSession(); throw new Error('Signed out, please sign in again'); }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally { clearTimeout(t); }
}

function dropSession() {
  state.sync.token = null;
  state.sync.userEmail = null;
  save();
}

export async function initSync(onAuth) {
  if (!status.enabled) return;
  await finishSignIn();
  onAuth?.();
  addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  syncNow();
}

// Returning from Google: the ID token arrives in the URL fragment.
async function finishSignIn() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('id_token') && !h.has('error')) return;
  history.replaceState(null, '', location.pathname + location.search);
  const expected = localStorage.getItem(NONCE_KEY);
  localStorage.removeItem(NONCE_KEY);
  if (h.has('error')) { status.error = `Google sign-in: ${h.get('error')}`; return; }
  const idToken = h.get('id_token');
  try {
    const claims = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!expected || claims.nonce !== expected) throw new Error('Sign-in check failed, please try again');
    const { token, email } = await post('/auth/google', { idToken }, null);
    state.sync.token = token;
    state.sync.userEmail = email;
    state.sync.lastSync = null; // first sync on this device adopts the cloud program
    save();
  } catch (e) {
    status.error = e.message;
  }
}

export const signedIn = () => !!state.sync.token;
export const accessToken = async () => state.sync.token;

export function signIn() {
  if (!status.enabled) throw new Error('Sync is not configured');
  const nonce = crypto.randomUUID();
  localStorage.setItem(NONCE_KEY, nonce);
  const q = new URLSearchParams({
    client_id: CONFIG.googleClientId,
    redirect_uri: appUrl(),
    response_type: 'id_token',
    scope: 'openid email',
    nonce,
    prompt: 'select_account',
  });
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function signOut() {
  try { await post('/logout'); } catch {}
  dropSession();
  state.sync.cursor = null;
  commit('auth');
}

export function scheduleSync(ms = 2500) {
  if (!status.enabled) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

export function syncNow() {
  if (!status.enabled || !signedIn() || !navigator.onLine) return Promise.resolve();
  if (running) return running;
  running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  status.busy = true; status.error = null; commit('sync');
  try {
    const firstSync = !state.sync.lastSync;
    const sent = state.sync.dirty.map((id) => state.sessions[id]).filter(Boolean);
    const stamps = sent.map((s) => [s.id, s.updatedAt]);
    if (!state.programUpdatedAt) state.programUpdatedAt = Date.now();
    const sendProfile = state.sync.dirtyProfile && !firstSync;
    const profileAt = state.programUpdatedAt;
    const res = await post('/sync', {
      since: Math.max(0, (state.sync.cursor || 0) - 60000),
      workouts: sent,
      profile: sendProfile ? { program: state.program, settings: state.settings, updatedAt: profileAt } : null,
    });

    // Clear what the server now has, unless it was edited again while the request was in flight.
    const clean = new Set(stamps.filter(([id, at]) => state.sessions[id]?.updatedAt === at).map(([id]) => id));
    state.sync.dirty = state.sync.dirty.filter((id) => !clean.has(id));
    if (sendProfile && state.programUpdatedAt === profileAt) state.sync.dirtyProfile = false;

    for (const w of res.workouts) {
      const local = state.sessions[w.id];
      if (!local || (w.updatedAt || 0) > (local.updatedAt || 0)) {
        state.sessions[w.id] = w;
        state.sync.dirty = state.sync.dirty.filter((id) => id !== w.id);
        if (w.deleted && state.activeId === w.id) state.activeId = null;
      }
    }
    state.sync.cursor = res.cursor;

    const p = res.profile;
    if (p && (firstSync || p.updatedAt > state.programUpdatedAt)) {
      if (p.program) state.program = p.program;
      if (p.settings) state.settings = { ...state.settings, ...p.settings, startDate: p.settings.startDate || state.settings.startDate };
      state.programUpdatedAt = p.updatedAt;
      state.sync.dirtyProfile = false;
    } else if (!p || firstSync) {
      state.sync.dirtyProfile = !p ? true : state.sync.dirtyProfile;
    }
    state.sync.lastSync = Date.now();
    save();
    // A first sync that adopted nothing, or local edits still pending, gets pushed on the next round.
    if (state.sync.dirty.length || state.sync.dirtyProfile) scheduleSync(500);
  } catch (e) {
    status.error = e.name === 'AbortError' ? 'Sync timed out' : e.message || String(e);
  } finally {
    status.busy = false;
    commit('sync');
  }
}
