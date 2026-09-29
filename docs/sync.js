// Supabase auth (Google) + two-way sync. Local state is the source of truth; last write wins per record.
import CONFIG from './config.js';
import { state, commit, save } from './store.js';

const SB_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
let sb = null;
let session = null;
let running = null;
let timer = null;
export const status = { enabled: !!CONFIG.supabaseUrl, busy: false, error: null };

export async function initSync(onAuth) {
  if (!status.enabled) return;
  try {
    const { createClient } = await import(SB_ESM);
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await sb.auth.getSession();
    session = data.session;
    sb.auth.onAuthStateChange((_e, s) => {
      const was = !!session;
      session = s;
      state.sync.userEmail = s?.user?.email || null;
      save();
      onAuth?.();
      if (s && !was) syncNow();
    });
    state.sync.userEmail = session?.user?.email || null;
    if (location.search.includes('code=')) history.replaceState(null, '', location.pathname);
    onAuth?.();
    if (session) syncNow();
  } catch (e) {
    status.error = 'Offline: sync library not loaded yet';
    onAuth?.();
  }
  addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
}

export const signedIn = () => !!session;
export const accessToken = async () => {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
};

export async function signIn() {
  if (!sb) throw new Error('Sync is not configured');
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  });
}

export async function signOut() {
  await sb?.auth.signOut();
  session = null;
  state.sync.userEmail = null;
  state.sync.cursor = null;
  commit('auth');
}

// Debounced sync after local edits.
export function scheduleSync(ms = 2500) {
  if (!status.enabled) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

export function syncNow() {
  if (!sb || !session || !navigator.onLine) return Promise.resolve();
  if (running) return running;
  running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  status.busy = true; status.error = null; commit('sync');
  try {
    await pull();
    await push();
    state.sync.lastSync = Date.now();
  } catch (e) {
    status.error = e.message || String(e);
  } finally {
    status.busy = false;
    commit('sync');
  }
}

async function pull() {
  const since = state.sync.cursor
    ? new Date(new Date(state.sync.cursor).getTime() - 60000).toISOString()
    : '1970-01-01T00:00:00Z';
  let cursor = state.sync.cursor;
  const firstSync = !state.sync.lastSync;
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from('gt_sessions').select('id,data,server_updated_at')
      .gt('server_updated_at', since).order('server_updated_at').range(from, from + 499);
    if (error) throw error;
    for (const row of data) {
      const local = state.sessions[row.id];
      if (!local || (row.data.updatedAt || 0) > (local.updatedAt || 0)) {
        state.sessions[row.id] = row.data;
        state.sync.dirty = state.sync.dirty.filter((id) => id !== row.id);
        if (row.data.deleted && state.activeId === row.id) state.activeId = null;
      }
      if (!cursor || row.server_updated_at > cursor) cursor = row.server_updated_at;
    }
    if (data.length < 500) break;
  }
  state.sync.cursor = cursor;

  const { data: prof, error } = await sb.from('gt_profile').select('program,settings,client_updated_at').maybeSingle();
  if (error) throw error;
  if (prof) {
    const remoteAt = new Date(prof.client_updated_at).getTime();
    // A device that has never synced adopts the cloud program (its own copy is just the default).
    if (firstSync || remoteAt > (state.programUpdatedAt || 0)) {
      if (prof.program) state.program = prof.program;
      if (prof.settings) state.settings = { ...state.settings, ...prof.settings, startDate: prof.settings.startDate || state.settings.startDate };
      state.programUpdatedAt = remoteAt;
      state.sync.dirtyProfile = false;
    }
  } else {
    state.sync.dirtyProfile = true; // first device: seed the profile
  }
  save();
}

async function push() {
  const ids = [...state.sync.dirty];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).map((id) => state.sessions[id]).filter(Boolean);
    const stamp = chunk.map((s) => [s.id, s.updatedAt]);
    const rows = chunk.map((s) => ({
      id: s.id, data: s, deleted: !!s.deleted, client_updated_at: new Date(s.updatedAt).toISOString(),
    }));
    const { error } = await sb.from('gt_sessions').upsert(rows);
    if (error) throw error;
    // Only clear records that weren't edited again while the request was in flight.
    const clean = new Set(stamp.filter(([id, at]) => state.sessions[id]?.updatedAt === at).map(([id]) => id));
    state.sync.dirty = state.sync.dirty.filter((id) => !clean.has(id));
  }
  if (state.sync.dirtyProfile) {
    if (!state.programUpdatedAt) state.programUpdatedAt = Date.now();
    const at = state.programUpdatedAt;
    const { error } = await sb.from('gt_profile').upsert({
      user_id: session.user.id, program: state.program, settings: state.settings,
      client_updated_at: new Date(at).toISOString(),
    });
    if (error) throw error;
    if (state.programUpdatedAt === at) state.sync.dirtyProfile = false;
  }
  save();
}
