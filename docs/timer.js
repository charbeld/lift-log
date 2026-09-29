// Rest timer: timestamp based (survives locking the phone / reloads), with a server-scheduled
// Web Push so the alert reaches the lock screen when the app is suspended.
import CONFIG from './config.js';
import { state, save, fmtClock } from './store.js';
import { accessToken, signedIn } from './sync.js';

const $ = (id) => document.getElementById(id);
let tick = null;
let audio = null;
let alerted = false;

export const pushConfigured = () => !!(CONFIG.apiUrl && CONFIG.vapidPublicKey);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// iOS only lets audio start inside a user gesture, so warm it up on the first tap.
export function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {}
}

function beep() {
  if (!state.prefs.sound || !audio) return;
  const t0 = audio.currentTime + 0.02;
  [0, 0.28, 0.56].forEach((dt, i) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.22);
    o.connect(g).connect(audio.destination);
    o.start(t0 + dt); o.stop(t0 + dt + 0.25);
  });
  navigator.vibrate?.([200, 100, 200]);
}

export function startRest(seconds, label, next) {
  state.timer = { endAt: Date.now() + seconds * 1000, total: seconds, label, next };
  alerted = false;
  save();
  schedulePush();
  run();
}

export function adjustRest(delta) {
  const t = state.timer;
  if (!t) return;
  t.endAt += delta * 1000;
  t.total = Math.max(5, t.total + delta);
  if (t.endAt - Date.now() > 0) alerted = false;
  save();
  schedulePush();
  paint();
}

export function stopRest() {
  const had = !!state.timer;
  state.timer = null;
  save();
  if (had) cancelPush();
  paint();
}

export function resumeTimer() {
  if (state.timer && state.timer.endAt < Date.now() - 60000) state.timer = null;
  if (state.timer) { alerted = state.timer.endAt <= Date.now(); run(); }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && paint());
  $('timer').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    unlockAudio();
    const v = b.dataset.t;
    if (v === 'skip') stopRest(); else adjustRest(+v);
  });
}

function run() {
  clearInterval(tick);
  tick = setInterval(paint, 250);
  paint();
}

function paint() {
  const t = state.timer, el = $('timer');
  if (!t) {
    clearInterval(tick);
    el.hidden = true; el.classList.remove('over');
    document.body.classList.remove('timer-on');
    return;
  }
  el.hidden = false;
  document.body.classList.add('timer-on');
  const left = (t.endAt - Date.now()) / 1000;
  if (left <= 0) {
    if (!alerted) { alerted = true; beep(); el.classList.add('over'); }
    $('timerTime').textContent = 'Go';
    $('timerLabel').textContent = t.next ? `Next: ${t.next}` : 'Rest over';
    $('timerFill').style.width = '0%';
    if (left < -8) { state.timer = null; save(); paint(); }
    return;
  }
  el.classList.remove('over');
  $('timerTime').textContent = fmtClock(left);
  $('timerLabel').textContent = t.next ? `Rest · next: ${t.next}` : `Rest · ${t.label}`;
  $('timerFill').style.width = `${Math.min(100, (left / t.total) * 100)}%`;
}

// ---------- Web Push ----------
const b64uToBytes = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export async function enablePush() {
  if (!pushConfigured()) throw new Error('Push server is not configured');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error(isStandalone() ? 'This iOS version does not support web push (needs 16.4+)' : 'Add Lift Log to your Home Screen first, then enable alerts from there');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications were not allowed. Enable them in iOS Settings → Notifications → Lift Log');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(CONFIG.vapidPublicKey) });
  state.pushSub = sub.toJSON();
  state.prefs.push = true;
  save();
}

export async function disablePush() {
  state.prefs.push = false;
  save();
  try { const reg = await navigator.serviceWorker.ready; (await reg.pushManager.getSubscription())?.unsubscribe(); } catch {}
  state.pushSub = null;
  save();
}

async function call(path, body) {
  if (!state.prefs.push || !state.pushSub || !pushConfigured() || !signedIn() || !navigator.onLine) return;
  try {
    const token = await accessToken();
    if (!token) return;
    await fetch(CONFIG.apiUrl.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {}
}

function schedulePush() {
  const t = state.timer;
  if (!t) return;
  call('/schedule', {
    subscription: state.pushSub,
    fireAt: t.endAt,
    title: 'Rest over',
    body: t.next ? `Next: ${t.next}` : 'Time for your next set',
  });
}

function cancelPush() { call('/cancel', {}); }

export function sendTestPush() {
  return call('/schedule', { subscription: state.pushSub, fireAt: Date.now() + 5000, title: 'Lift Log', body: 'Lock-screen alerts are working 💪' });
}
