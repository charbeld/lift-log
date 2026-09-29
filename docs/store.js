// Local-first state: everything lives in localStorage and is synced to the Worker (Cloudflare D1) by sync.js.
import { freshProgram } from './program.js';

const KEY = 'liftlog:v1';

function blank() {
  return {
    v: 1,
    program: freshProgram(),
    programUpdatedAt: 0,
    settings: { startDate: null },
    prefs: { sound: true, wake: true, push: false },
    pushSub: null,
    sessions: {},
    activeId: null,
    timer: null,
    sync: { cursor: null, dirty: [], dirtyProfile: false, lastSync: null, userEmail: null },
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...blank(), ...s, sync: { ...blank().sync, ...s.sync } };
  } catch {}
  return blank();
}

export const state = load();
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function commit(kind = 'local') {
  save();
  listeners.forEach((fn) => fn(kind));
}

export function touchSession(s) {
  s.updatedAt = Date.now();
  if (!state.sync.dirty.includes(s.id)) state.sync.dirty.push(s.id);
  commit('session');
}

export function touchProfile() {
  state.programUpdatedAt = Date.now();
  state.sync.dirtyProfile = true;
  commit('profile');
}

export function replaceAll(next) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, blank(), next);
  save();
}

// ---------- dates ----------
export const todayStr = () => toDateStr(new Date());
export function toDateStr(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function weekFor(dateStr) {
  const start = state.settings.startDate;
  if (!start) return 1;
  const days = Math.round((parseDate(dateStr) - parseDate(start)) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}
export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// ---------- numbers ----------
export const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const fmtKg = (n) => (n == null ? '' : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
export const e1rm = (w, r) => (!w || !r ? 0 : r === 1 ? w : w * (1 + r / 30));
export const fmtDur = (ms) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
export const fmtClock = (sec) => {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

// ---------- sessions ----------
export const liveSessions = () =>
  Object.values(state.sessions).filter((s) => !s.deleted).sort((a, b) => (b.date + b.startedAt).localeCompare(a.date + a.startedAt));
export const finishedSessions = () => liveSessions().filter((s) => s.finishedAt);

export const doneSets = (ex) => (ex.sets || []).filter((st) => st.done && num(st.r) != null);

export function sessionStats(s) {
  let volume = 0, sets = 0;
  for (const ex of s.exercises) for (const st of doneSets(ex)) { sets++; volume += (num(st.w) || 0) * num(st.r); }
  const dur = s.finishedAt && s.startedAt ? new Date(s.finishedAt) - new Date(s.startedAt) : 0;
  return { volume, sets, dur };
}

// Most recent performance of an exercise before a given session.
export function lastPerformance(id, excludeId, beforeKey) {
  for (const s of liveSessions()) {
    if (s.id === excludeId) continue;
    if (beforeKey && (s.date + s.startedAt) >= beforeKey) continue;
    const ex = s.exercises.find((e) => e.id === id && doneSets(e).length);
    if (ex) return { session: s, ex };
  }
  return null;
}

// Double progression: all sets at the top of the range → add the increment, else +1 rep.
export function suggestion(item, last) {
  if (!last) return { w: null, reps: [], text: `Start around ${item.start}`, up: false };
  const sets = doneSets(last.ex);
  const topW = Math.max(...sets.map((s) => num(s.w) || 0));
  const atTop = sets.filter((s) => (num(s.w) || 0) === topW);
  const allTop = atTop.length >= item.sets && atTop.every((s) => num(s.r) >= item.repMax);
  if (allTop && item.inc > 0) {
    const w = +(topW + item.inc).toFixed(2);
    return { w, reps: Array(item.sets).fill(item.repMin), up: true, text: `Top of range hit: go ${fmtKg(w)} kg × ${item.repMin}` };
  }
  const reps = Array.from({ length: item.sets }, (_, i) => {
    const prev = num(atTop[i]?.r ?? sets[i]?.r);
    return prev == null ? item.repMin : Math.min(Math.max(prev + 1, item.repMin), item.repMax);
  });
  const w = topW || null;
  return { w, reps, up: false, text: allTop ? `Top of range: add reps or load` : `${w ? fmtKg(w) + ' kg · ' : ''}aim ${reps.join(' · ')}` };
}

export function newSession(day, date = todayStr()) {
  if (!state.settings.startDate) { state.settings.startDate = date; state.programUpdatedAt = Date.now(); state.sync.dirtyProfile = true; }
  const prog = state.program[day];
  const now = new Date().toISOString();
  const s = {
    id: crypto.randomUUID(), day, date, week: weekFor(date), startedAt: now, finishedAt: null,
    note: '', warmups: prog.warmups.map(() => false),
    exercises: prog.items.map((item) => buildExercise(item, date + now)),
    updatedAt: Date.now(), deleted: false,
  };
  state.sessions[s.id] = s;
  return s;
}

export function buildExercise(item, beforeKey) {
  const last = lastPerformance(item.id, null, beforeKey);
  const sug = suggestion(item, last);
  return {
    id: item.id, name: item.name, cat: item.cat,
    target: { sets: item.sets, repMin: item.repMin, repMax: item.repMax, rest: item.rest },
    sets: Array.from({ length: item.sets }, (_, i) => ({ w: sug.w != null ? fmtKg(sug.w) : '', r: '', tr: sug.reps[i] ?? item.repMin, done: false })),
    note: '', skipped: false,
  };
}

export function findItem(day, id) {
  return state.program[day]?.items.find((it) => it.id === id);
}

// All-time best e1RM for an exercise before a session (for PR flags).
export function bestBefore(id, beforeKey) {
  let best = 0;
  for (const s of liveSessions()) {
    if ((s.date + s.startedAt) >= beforeKey) continue;
    for (const ex of s.exercises) if (ex.id === id) for (const st of doneSets(ex)) best = Math.max(best, e1rm(num(st.w), num(st.r)));
  }
  return best;
}
