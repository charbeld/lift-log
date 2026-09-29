import { PROGRESSION_RULE, swapOptions, exId, freshProgram } from './program.js';
import {
  state, save, commit, onChange, touchSession, touchProfile, replaceAll,
  todayStr, toDateStr, parseDate, weekFor, mondayOf, num, fmtKg, e1rm, fmtDur, fmtClock,
  liveSessions, finishedSessions, doneSets, sessionStats, lastPerformance, suggestion,
  newSession, buildExercise, findItem, bestBefore,
} from './store.js';
import { initSync, scheduleSync, syncNow, signIn, signOut, signedIn, status as syncStatus } from './sync.js';
import {
  startRest, stopRest, resumeTimer, unlockAudio, enablePush, disablePush, sendTestPush, pushConfigured, isStandalone,
} from './timer.js';
import { renderCharts } from './charts.js';

const VERSION = '1.0.0';
const $ = (id) => document.getElementById(id);
const view = $('view');
const DAYS = ['A', 'B', 'C'];
const ui = {
  tab: sessionStorage.getItem('tab') || 'train',
  editingId: null, historyId: null, histMode: 'list', gridDay: 'A', programDay: 'A', progressEx: null,
  sheet: null,
};

// ---------- icons ----------
const P = {
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 13 3 3 0 0 0 6 19z"/>',
  cloudOff: '<path d="m2 2 20 20M9.2 5.3A6 6 0 0 1 16.1 10.2 4.5 4.5 0 0 1 21 16.6M17.5 19H6a3 3 0 0 1-1.5-6A6 6 0 0 1 5.7 7.7"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  swap: '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  pin: '<path d="M12 17v5M9 3h6l-1 7 4 3H6l4-3z"/>',
  skip: '<path d="m5 4 10 8-10 8zM19 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24">${P[n]}</svg>`;
document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
$('settingsBtn').innerHTML = icon('gear');

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDate = (s) => { const d = parseDate(s); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtShort = (s) => { const d = parseDate(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
function relDate(s) {
  const n = Math.round((parseDate(todayStr()) - parseDate(s)) / 86400000);
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : n < 14 ? `${n} days ago` : fmtShort(s);
}
const catLabel = { MACHINE: 'Machine', FREE: 'Free', CORE: 'Core', 'WARM-UP': 'Warm-up' };
const fmtVol = (v) => (v >= 10000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v).toLocaleString()} kg`);
const setTxt = (st) => `${num(st.w) ? fmtKg(num(st.w)) : 'BW'}×${num(st.r)}`;
const dayTitle = (d) => state.program[d]?.title || `Day ${d}`;

function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), ms);
}

function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }

// ---------- sheet ----------
function openSheet(html, ctx = {}) {
  ui.sheet = ctx;
  $('sheet').innerHTML = html;
  $('sheetWrap').hidden = false;
  $('sheet').querySelectorAll('textarea').forEach(autosize);
}
function closeSheet() { $('sheetWrap').hidden = true; $('sheet').innerHTML = ''; ui.sheet = null; }
$('sheetWrap').addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeSheet(); });

function confirmSheet(title, body, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    openSheet(`<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
      <div class="s-foot"><button class="btn block ${danger ? 'danger' : 'primary'}" data-act="sheet-ok">${esc(okLabel)}</button>
      <button class="btn block" data-act="sheet-cancel">Cancel</button></div>`, { resolve });
  });
}

// ---------- rendering ----------
function render() {
  sessionStorage.setItem('tab', ui.tab);
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  renderSyncIcon();
  const fn = { train: renderTrain, history: renderHistory, progress: renderProgress, program: renderProgram }[ui.tab];
  view.innerHTML = fn();
  view.querySelectorAll('textarea').forEach(autosize);
  if (ui.tab === 'progress') drawCharts();
  updateElapsed();
  manageWakeLock();
}

function renderSyncIcon() {
  const b = $('syncBtn');
  if (!syncStatus.enabled) { b.hidden = true; return; }
  b.hidden = false;
  const on = signedIn();
  const pending = state.sync.dirty.length + (state.sync.dirtyProfile ? 1 : 0);
  b.innerHTML = icon(on && navigator.onLine ? 'cloud' : 'cloudOff');
  b.className = 'icon-btn ' + (!on ? 'warn' : syncStatus.error ? 'warn' : pending || syncStatus.busy ? '' : 'ok');
  b.title = !on ? 'Not signed in' : syncStatus.error || (pending ? `${pending} change(s) waiting to sync` : 'Synced');
}

const activeSession = () => {
  const s = state.sessions[state.activeId];
  return s && !s.deleted && !s.finishedAt ? s : null;
};

// ----- Train -----
function nextDay() {
  const last = finishedSessions()[0];
  return last ? DAYS[(DAYS.indexOf(last.day) + 1) % 3] : 'A';
}

function renderTrain() {
  if (ui.editingId && state.sessions[ui.editingId]) return renderSession(state.sessions[ui.editingId], 'edit');
  const act = activeSession();
  if (act) return renderSession(act, 'active');
  const today = todayStr();
  const next = nextDay();
  const cards = DAYS.map((d) => {
    const p = state.program[d];
    const last = finishedSessions().find((s) => s.day === d);
    return `<button class="card day-card ${d === next ? 'next' : ''}" data-act="start" data-day="${d}">
      <span class="letter">${d}</span>
      ${d === next ? '<div class="tag">Up next</div>' : ''}
      <h2>${esc(p.title)}</h2><p>${esc(p.subtitle)}</p>
      <div class="meta">${p.items.length} exercises · ${last ? 'last done ' + relDate(last.date) : 'not done yet'}</div>
    </button>`;
  }).join('');
  return `<div class="hero"><div class="eyebrow">Week ${weekFor(today)} · ${fmtDate(today)}</div><h1>Start a workout</h1></div>
    ${cards}
    <p style="text-align:center;margin-top:22px"><button class="link" data-act="log-past">Log a past workout</button></p>`;
}

function renderSession(s, mode) {
  const prog = state.program[s.day] || { title: `Day ${s.day}`, warmups: [] };
  const total = s.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0);
  const done = s.exercises.reduce((a, e) => a + (e.skipped ? 0 : doneSets(e).length), 0);
  const wu = prog.warmups || [];
  const wuDone = (s.warmups || []).filter(Boolean).length;
  const head = mode === 'edit'
    ? `<div class="eyebrow">Editing · Week ${s.week}</div><h1>${esc(prog.title)}</h1>
       <label class="field"><span>Date</span><input type="date" data-bind="sdate" value="${s.date}"></label>`
    : `<div class="eyebrow">Week ${s.week} · ${fmtDate(s.date)}</div><h1>${esc(prog.title)}</h1>`;
  return `<div class="s-head"><div class="grow">${head}</div>${mode === 'active' ? '<div class="elapsed" id="elapsed"></div>' : ''}</div>
    <div class="progress-line"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>
    ${wu.length ? `<details class="card warmups" ${wuDone < wu.length && mode === 'active' && done === 0 ? 'open' : ''}>
      <summary><span class="chip WARM-UP">Warm-up</span><span class="grow">${wuDone}/${wu.length} done</span>${icon('down')}</summary>
      ${wu.map((w, k) => `<div class="wu"><button class="check" style="${s.warmups?.[k] ? 'background:var(--warm);color:#1a1205' : ''}" data-act="wu" data-k="${k}">${icon('check')}</button>
        <div class="grow"><div class="t">${esc(w.name)} <span class="muted small">· ${esc(w.detail)}</span></div><div class="d">${esc(w.notes)}</div></div></div>`).join('')}
    </details>` : ''}
    <div id="exList">${s.exercises.map((ex, i) => exCard(s, ex, i)).join('')}</div>
    <label class="field"><span>Workout notes</span><textarea class="note" data-bind="snote" placeholder="How did it go? Energy, sleep, gym busy…">${esc(s.note)}</textarea></label>
    <div class="s-foot">
      ${mode === 'active'
        ? `<button class="btn primary block" data-act="finish">Finish workout</button><button class="btn danger block" data-act="discard">Discard workout</button>`
        : `<button class="btn primary block" data-act="edit-done">Done editing</button><button class="btn danger block" data-act="delete-session" data-id="${s.id}">Delete workout</button>`}
    </div>`;
}

function exCard(s, ex, i) {
  const item = findItem(s.day, ex.id);
  const key = s.date + s.startedAt;
  const last = lastPerformance(ex.id, s.id, key);
  const sug = suggestion({ ...ex.target, inc: item?.inc ?? 2.5, start: item?.start || 'a comfortable weight' }, last);
  const best = bestBefore(ex.id, key);
  const nDone = doneSets(ex).length;
  const complete = ex.sets.length && nDone >= ex.sets.length;
  const cue = item?.notes ?? ex.cue ?? '';
  const lastLine = last
    ? `<div class="l1">Last · ${fmtShort(last.session.date)} (wk ${last.session.week}): <b>${doneSets(last.ex).map(setTxt).join(' · ')}</b></div>`
    : '<div class="l1">First time logging this one</div>';
  const sets = ex.sets.map((st, j) => {
    const isPR = st.done && best > 0 && e1rm(num(st.w), num(st.r)) > best;
    return `<div class="set ${st.done ? 'done' : ''} ${isPR ? 'pr' : ''}" data-i="${i}" data-j="${j}">
      <span class="n">${isPR ? '★' : j + 1}</span>
      <input inputmode="decimal" enterkeyhint="next" data-bind="w" value="${esc(st.w)}" placeholder="${sug.w != null ? fmtKg(sug.w) : 'kg'}" aria-label="Set ${j + 1} weight">
      <input inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" data-bind="r" value="${esc(st.r)}" placeholder="${st.tr ?? ''}" aria-label="Set ${j + 1} reps">
      <button class="check" data-act="set-done" aria-label="Mark set ${j + 1} done">${icon('check')}</button>
    </div>`;
  }).join('');
  return `<article class="card ex ${complete ? 'complete' : ''} ${ex.skipped ? 'skipped' : ''}" id="ex-${i}">
    <div class="ex-top"><div class="ex-n">${i + 1}</div>
      <div class="grow"><h2>${esc(ex.name)}</h2>
        <div class="ex-meta"><span class="chip ${ex.cat}">${catLabel[ex.cat] || ex.cat}</span><span>${ex.target.sets} × ${ex.target.repMin}–${ex.target.repMax}</span><span>rest ${fmtClock(ex.target.rest)}</span>${ex.skipped ? '<span class="chip">Skipped</span>' : ''}</div>
      </div>
      <button class="icon-btn" data-act="ex-menu" data-i="${i}" aria-label="Exercise options">${icon('more')}</button>
    </div>
    ${cue ? `<p class="cue">${esc(cue)}</p>` : ''}
    ${item?.myNote ? `<div class="mynote">${esc(item.myNote)}</div>` : ''}
    ${ex.skipped ? '' : `<div class="last">${lastLine}<div class="sug ${sug.up ? 'up' : ''}">${sug.up ? '↑ ' : ''}${esc(sug.text)}</div></div>
    <div class="sets"><div class="set-h"><span></span><span>kg</span><span>Reps</span><span></span></div>${sets}</div>
    <div class="ex-actions"><button class="btn sm" data-act="add-set" data-i="${i}">+ Set</button><button class="btn sm" data-act="rm-set" data-i="${i}" ${ex.sets.length <= 1 ? 'disabled' : ''}>− Set</button></div>`}
    <textarea class="note" data-bind="exnote" data-i="${i}" rows="1" placeholder="Note for today…">${esc(ex.note)}</textarea>
    ${last?.ex.note ? `<div class="prevnote">Last note: ${esc(last.ex.note)}</div>` : ''}
  </article>`;
}

function rerenderCard(s, i) {
  const el = $(`ex-${i}`);
  if (!el) return render();
  el.outerHTML = exCard(s, s.exercises[i], i);
  $(`ex-${i}`).querySelectorAll('textarea').forEach(autosize);
  const total = s.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0);
  const done = s.exercises.reduce((a, e) => a + (e.skipped ? 0 : doneSets(e).length), 0);
  const bar = view.querySelector('.progress-line > div');
  if (bar) bar.style.width = `${total ? (done / total) * 100 : 0}%`;
}

function updateElapsed() {
  const el = $('elapsed'), s = activeSession();
  if (el && s) el.textContent = fmtClock((Date.now() - new Date(s.startedAt)) / 1000);
}
setInterval(updateElapsed, 1000);

let wakeLock = null;
async function manageWakeLock() {
  const want = state.prefs.wake && activeSession() && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', manageWakeLock);

// ----- History -----
function renderHistory() {
  if (ui.historyId && state.sessions[ui.historyId] && !state.sessions[ui.historyId].deleted) return renderHistoryDetail(state.sessions[ui.historyId]);
  const seg = `<div class="seg" style="margin:6px 0 4px">
    <button class="${ui.histMode === 'list' ? 'on' : ''}" data-act="hist-mode" data-m="list">Workouts</button>
    <button class="${ui.histMode === 'grid' ? 'on' : ''}" data-act="hist-mode" data-m="grid">Week by week</button></div>`;
  if (ui.histMode === 'grid') return seg + renderWeekGrid();
  const list = finishedSessions();
  if (!list.length) return seg + '<div class="empty">No workouts saved yet.<br>Finish your first session and it will show up here.</div>';
  const byWeek = new Map();
  for (const s of list) { if (!byWeek.has(s.week)) byWeek.set(s.week, []); byWeek.get(s.week).push(s); }
  let html = seg;
  for (const [wk, ss] of byWeek) {
    const vol = ss.reduce((a, s) => a + sessionStats(s).volume, 0);
    html += `<div class="wk-h"><h3>Week ${wk}</h3><span class="small faint">${ss.length} workout${ss.length > 1 ? 's' : ''} · ${fmtVol(vol)}</span></div>`;
    html += ss.map((s) => {
      const st = sessionStats(s);
      return `<button class="card h-item" data-act="open-hist" data-id="${s.id}">
        <div class="h-badge ${s.day}">${s.day}</div>
        <div class="grow"><div style="font-weight:700">${esc(dayTitle(s.day))}</div>
          <div class="h-stats"><span>${fmtDate(s.date)}</span><span>${st.sets} set${st.sets === 1 ? "" : "s"}</span><span>${fmtVol(st.volume)}</span>${st.dur ? `<span>${fmtDur(st.dur)}</span>` : ''}</div></div>
        ${icon('back').replace('class="i"', 'class="i" style="transform:rotate(180deg);color:var(--faint)"')}
      </button>`;
    }).join('');
  }
  return html;
}

function renderHistoryDetail(s) {
  const st = sessionStats(s);
  const key = s.date + s.startedAt;
  const exs = s.exercises.filter((e) => doneSets(e).length || e.note).map((e) => {
    const best = bestBefore(e.id, key);
    return `<div class="card d-ex"><div class="row"><h2 class="grow">${esc(e.name)}</h2>${e.skipped ? '<span class="chip">Skipped</span>' : ''}</div>
      <div class="d-sets">${doneSets(e).map((x) => `<span class="d-set ${best > 0 && e1rm(num(x.w), num(x.r)) > best ? 'pr' : ''}">${setTxt(x)}</span>`).join('')}</div>
      ${e.note ? `<div class="d-note">${esc(e.note)}</div>` : ''}</div>`;
  }).join('');
  return `<button class="btn sm" data-act="hist-back" style="margin:4px 0 14px">${icon('back')} History</button>
    <div class="eyebrow">Week ${s.week} · ${fmtDate(s.date)}</div><h1>${esc(dayTitle(s.day))}</h1>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr);margin-top:16px">
      <div class="card tile"><div class="v">${st.dur ? fmtDur(st.dur) : '–'}</div><div class="k">Duration</div></div>
      <div class="card tile"><div class="v">${st.sets}</div><div class="k">Sets</div></div>
      <div class="card tile"><div class="v" style="font-size:22px">${fmtVol(st.volume)}</div><div class="k">Volume</div></div>
    </div>
    ${s.note ? `<h3>Notes</h3><div class="card d-note" style="margin:0">${esc(s.note)}</div>` : ''}
    <h3>Exercises</h3>${exs || '<div class="empty">No sets logged.</div>'}
    <div class="s-foot"><button class="btn block" data-act="edit-session" data-id="${s.id}">${icon('edit')} Edit workout</button>
      <button class="btn block danger" data-act="delete-session" data-id="${s.id}">${icon('trash')} Delete</button></div>`;
}

function renderWeekGrid() {
  const d = ui.gridDay;
  const seg = `<div class="seg" style="margin:10px 0 14px">${DAYS.map((x) => `<button class="${x === d ? 'on' : ''}" data-act="grid-day" data-d="${x}">Day ${x}</button>`).join('')}</div>`;
  const sessions = finishedSessions().filter((s) => s.day === d).reverse(); // oldest first
  if (!sessions.length) return seg + `<div class="empty">No Day ${d} workouts yet.</div>`;
  const byWeek = new Map();
  for (const s of sessions) byWeek.set(s.week, s); // latest session in each week wins
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const ids = [...state.program[d].items.map((it) => it.id)];
  const names = Object.fromEntries(state.program[d].items.map((it) => [it.id, it.name]));
  for (const s of sessions) for (const e of s.exercises) if (!ids.includes(e.id) && doneSets(e).length) { ids.push(e.id); names[e.id] = e.name; }
  const rows = ids.map((id) => {
    let prevTop = null;
    const cells = weeks.map((w) => {
      const e = byWeek.get(w).exercises.find((x) => x.id === id);
      const ds = e ? doneSets(e) : [];
      if (!ds.length) return '<td class="faint">–</td>';
      const top = Math.max(...ds.map((x) => num(x.w) || 0));
      const up = prevTop != null && top > prevTop;
      prevTop = top;
      return `<td><span class="w ${up ? 'up' : ''}">${top ? fmtKg(top) : 'BW'}</span> <span class="r">× ${ds.map((x) => num(x.r)).join('·')}</span></td>`;
    }).join('');
    return `<tr><td>${esc(names[id])}</td>${cells}</tr>`;
  }).join('');
  return seg + `<div class="grid-wrap"><table class="wg"><thead><tr><th>Exercise</th>${weeks.map((w) => `<th>Wk ${w}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small faint">Top weight × reps per set. Green = heavier than the week before.</p>`;
}

// ----- Progress -----
function exerciseCatalog() {
  const map = new Map();
  for (const d of DAYS) for (const it of state.program[d].items) map.set(it.id, { id: it.id, name: it.name, day: d, n: 0 });
  for (const s of finishedSessions()) for (const e of s.exercises) {
    if (!doneSets(e).length) continue;
    if (!map.has(e.id)) map.set(e.id, { id: e.id, name: e.name, day: s.day, n: 0 });
    map.get(e.id).n++;
  }
  return [...map.values()];
}

function renderProgress() {
  const list = finishedSessions();
  if (!list.length) return '<div class="empty">Progress charts appear after your first saved workout.</div>';
  const now = new Date();
  const thisMon = mondayOf(now), lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7);
  const inRange = (s, a, b) => { const d = parseDate(s.date); return d >= a && d < b; };
  const nextMon = new Date(thisMon); nextMon.setDate(nextMon.getDate() + 7);
  const thisWeek = list.filter((s) => inRange(s, thisMon, nextMon));
  const lastWeek = list.filter((s) => inRange(s, lastMon, thisMon));
  const vol = (ss) => ss.reduce((a, s) => a + sessionStats(s).volume, 0);
  const vThis = vol(thisWeek), vLast = vol(lastWeek);
  const delta = vLast && vThis ? Math.round(((vThis - vLast) / vLast) * 100) : null;
  // week streak: consecutive Monday-weeks with ≥1 workout, counting back from this week (or last week if none yet)
  const weeksWith = new Set(list.map((s) => toDateStr(mondayOf(parseDate(s.date)))));
  let streak = 0; const cur = new Date(thisMon);
  if (!weeksWith.has(toDateStr(cur))) cur.setDate(cur.getDate() - 7);
  while (weeksWith.has(toDateStr(cur))) { streak++; cur.setDate(cur.getDate() - 7); }

  const cat = exerciseCatalog();
  if (!ui.progressEx || !cat.find((c) => c.id === ui.progressEx)) ui.progressEx = (cat.find((c) => c.n) || cat[0]).id;
  const opts = DAYS.map((d) => `<optgroup label="Day ${d}">${cat.filter((c) => c.day === d).map((c) => `<option value="${c.id}" ${c.id === ui.progressEx ? 'selected' : ''}>${esc(c.name)}${c.n ? '' : ' (no data)'}</option>`).join('')}</optgroup>`).join('');

  return `<div class="hero"><div class="eyebrow">${list.length} workouts logged</div><h1>Progress</h1></div>
    <div class="tiles">
      <div class="card tile"><div class="v">${thisWeek.length}<span class="faint" style="font-size:18px">/3</span></div><div class="k">Workouts this week</div></div>
      <div class="card tile"><div class="v">${streak}</div><div class="k">Week streak</div></div>
      <div class="card tile"><div class="v" style="font-size:22px">${fmtVol(vThis)}</div><div class="k">Volume this week</div>${delta != null ? `<div class="d ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : ''}${delta}% vs last week</div>` : ''}</div>
      <div class="card tile"><div class="v">${list.reduce((a, s) => a + sessionStats(s).sets, 0)}</div><div class="k">Total sets</div></div>
    </div>
    <h3>Consistency</h3><div class="card">${calendar(list)}</div>
    <h3>Weekly volume</h3><div class="card"><div class="chart-box"><canvas id="cWeekly"></canvas></div></div>
    <h3>Exercise</h3><select class="pick" id="exPick">${opts}</select>
    <div class="card" style="margin-top:12px"><div class="lg"><span><i style="background:var(--accent)"></i>Top weight</span><span><i style="background:var(--machine)"></i>Est. 1RM</span></div><div class="chart-box"><canvas id="cStrength"></canvas></div></div>
    <div class="card" style="margin-top:12px"><div class="lg"><span><i style="background:var(--warm)"></i>Volume per session (kg)</span></div><div class="chart-box" style="height:180px"><canvas id="cVolume"></canvas></div></div>
    <div class="card ex-hist" style="margin-top:12px" id="exHist"></div>`;
}

function calendar(list) {
  const WEEKS = 18;
  const vols = new Map();
  for (const s of list) {
    const v = vols.get(s.date) || { v: 0, days: '' };
    v.v += sessionStats(s).volume; v.days += s.day; vols.set(s.date, v);
  }
  const all = [...vols.values()].map((x) => x.v).sort((a, b) => a - b);
  const q = (p) => all[Math.floor((all.length - 1) * p)] || 0;
  const t1 = q(0.33), t2 = q(0.66);
  const start = mondayOf(new Date()); start.setDate(start.getDate() - 7 * (WEEKS - 1));
  const today = todayStr();
  let cells = '';
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const ds = toDateStr(d), v = vols.get(ds);
    const lvl = !v ? '' : v.v > t2 ? 'l3' : v.v > t1 ? 'l2' : 'l1';
    cells += `<div class="${lvl} ${ds === today ? 'today' : ''} ${ds > today ? 'future' : ''}" title="${ds}">${v ? v.days : ''}</div>`;
  }
  return `<div class="cal">${cells}</div><div class="cal-legend"><span>${fmtShort(toDateStr(start))}</span><span>Mon → Sun, letter = day trained</span><span>Today</span></div>`;
}

function drawCharts() {
  const list = finishedSessions();
  if (!list.length) return;
  const weeks = [];
  const thisMon = mondayOf(new Date());
  for (let k = 11; k >= 0; k--) { const m = new Date(thisMon); m.setDate(m.getDate() - 7 * k); weeks.push(m); }
  const weekly = weeks.map((m) => {
    const end = new Date(m); end.setDate(end.getDate() + 7);
    return list.filter((s) => { const d = parseDate(s.date); return d >= m && d < end; }).reduce((a, s) => a + sessionStats(s).volume, 0);
  });
  const id = ui.progressEx;
  const points = list.slice().reverse().map((s) => {
    const e = s.exercises.find((x) => x.id === id);
    const ds = e ? doneSets(e) : [];
    if (!ds.length) return null;
    return {
      s, date: s.date,
      top: Math.max(...ds.map((x) => num(x.w) || 0)),
      e1: Math.max(...ds.map((x) => e1rm(num(x.w), num(x.r)))),
      vol: ds.reduce((a, x) => a + (num(x.w) || 0) * num(x.r), 0),
      sets: ds,
    };
  }).filter(Boolean);
  renderCharts({
    weeklyLabels: weeks.map((m) => fmtShort(toDateStr(m))), weekly,
    labels: points.map((p) => fmtShort(p.date)), top: points.map((p) => p.top), e1: points.map((p) => Math.round(p.e1 * 10) / 10), vol: points.map((p) => Math.round(p.vol)),
  }).catch(() => {});
  let best = 0;
  const rows = points.map((p) => { const pr = p.e1 > best && best > 0; best = Math.max(best, p.e1); return { ...p, pr }; }).reverse();
  $('exHist').innerHTML = rows.length
    ? rows.map((p) => `<div class="r"><span><b>${fmtShort(p.date)}</b> <span class="faint">wk ${p.s.week}</span> ${p.pr ? '<span class="chip pr">PR</span>' : ''}</span><span class="num">${p.sets.map(setTxt).join(' · ')}</span></div>`).join('')
    : '<div class="muted small">No sets logged for this exercise yet.</div>';
}

// ----- Program -----
function renderProgram() {
  const d = ui.programDay, p = state.program[d];
  const seg = `<div class="seg" style="margin:6px 0 16px">${DAYS.map((x) => `<button class="${x === d ? 'on' : ''}" data-act="prog-day" data-d="${x}">Day ${x}</button>`).join('')}</div>`;
  const items = p.items.map((it, i) => `<div class="card p-item">
      <div class="row"><div class="grow"><h2>${esc(it.name)}</h2>
        <div class="ex-meta"><span class="chip ${it.cat}">${catLabel[it.cat] || it.cat}</span><span>${it.sets} × ${it.repMin}–${it.repMax}</span><span>rest ${fmtClock(it.rest)}</span><span>+${fmtKg(it.inc)} kg</span></div></div></div>
      <div class="small muted" style="margin-top:6px">Starting weight: ${esc(it.start)}</div>
      ${it.notes ? `<p class="cue">${esc(it.notes)}</p>` : ''}
      ${it.myNote ? `<div class="mynote">${esc(it.myNote)}</div>` : ''}
      <div class="p-actions">
        <button class="icon-btn" data-act="p-up" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button class="icon-btn" data-act="p-down" data-i="${i}" aria-label="Move down" ${i === p.items.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
        <span class="grow"></span>
        <button class="icon-btn" data-act="p-swap" data-i="${i}" aria-label="Swap">${icon('swap')}</button>
        <button class="icon-btn" data-act="p-edit" data-i="${i}" aria-label="Edit">${icon('edit')}</button>
        <button class="icon-btn" data-act="p-del" data-i="${i}" aria-label="Delete" style="color:var(--danger)">${icon('trash')}</button>
      </div></div>`).join('');
  return seg + `<div class="row" style="align-items:flex-start"><div class="grow"><h1>${esc(p.title)}</h1><p class="muted" style="margin:6px 0 0">${esc(p.subtitle)}</p></div>
      <button class="icon-btn" data-act="day-edit" aria-label="Edit day">${icon('edit')}</button></div>
    <div class="card rule" style="margin-top:16px"><b>Progression rule.</b> ${esc(PROGRESSION_RULE)}</div>
    <h3>Warm-up</h3>
    ${p.warmups.map((w, k) => `<div class="card p-item"><div class="row"><div class="grow"><b>${esc(w.name)}</b> <span class="muted small">· ${esc(w.detail)}</span><div class="cue" style="margin-top:4px">${esc(w.notes)}</div></div>
      <button class="icon-btn" data-act="wu-edit" data-k="${k}" aria-label="Edit warm-up">${icon('edit')}</button></div></div>`).join('')}
    <button class="btn sm" data-act="wu-edit" data-k="-1" style="margin-top:10px">${icon('plus')} Warm-up</button>
    <h3>Exercises</h3>${items}
    <button class="btn block" data-act="p-edit" data-i="-1" style="margin-top:12px">${icon('plus')} Add exercise</button>`;
}

function itemForm(it) {
  const cats = ['MACHINE', 'FREE', 'CORE'];
  return `<label class="field"><span>Name</span><input name="name" value="${esc(it.name)}" required></label>
    <div class="grid2"><label class="field"><span>Type</span><select name="cat">${cats.map((c) => `<option value="${c}" ${c === it.cat ? 'selected' : ''}>${catLabel[c]}</option>`).join('')}</select></label>
      <label class="field"><span>Sets</span><input name="sets" inputmode="numeric" value="${it.sets}"></label></div>
    <div class="grid3"><label class="field"><span>Reps min</span><input name="repMin" inputmode="numeric" value="${it.repMin}"></label>
      <label class="field"><span>Reps max</span><input name="repMax" inputmode="numeric" value="${it.repMax}"></label>
      <label class="field"><span>Rest (sec)</span><input name="rest" inputmode="numeric" value="${it.rest}"></label></div>
    <div class="grid2"><label class="field"><span>Weight jump (kg)</span><input name="inc" inputmode="decimal" value="${it.inc}"></label>
      <label class="field"><span>Starting weight</span><input name="start" value="${esc(it.start)}"></label></div>
    <label class="field"><span>Form cues &amp; notes</span><textarea name="notes">${esc(it.notes)}</textarea></label>
    <label class="field"><span>My pinned note (shown during workouts)</span><textarea name="myNote" placeholder="e.g. Seat on notch 4, pin 7">${esc(it.myNote || '')}</textarea></label>`;
}

function readForm(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach((el) => (o[el.name] = el.value.trim()));
  return o;
}

// ---------- settings ----------
function openSettings() {
  const signed = signedIn();
  const push = state.prefs.push;
  const acct = !syncStatus.enabled
    ? '<p class="small muted">Cloud sync is not configured in <code>config.js</code>. Data is stored on this phone only.</p>'
    : signed
      ? `<div class="toggle"><div class="grow"><b>${esc(state.sync.userEmail || 'Signed in')}</b><div class="small muted">${syncStatus.error ? esc(syncStatus.error) : state.sync.lastSync ? 'Synced ' + new Date(state.sync.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not synced yet'}</div></div>
          <button class="btn sm" data-act="sync-now">Sync now</button></div>
         <button class="menu-item danger" data-act="sign-out">Sign out</button>`
      : `<p class="small muted">Sign in to back up and sync your workouts. Everything you logged offline will be uploaded.</p>
         <button class="btn primary block" data-act="sign-in">Sign in with Google</button>`;
  const pushRow = !pushConfigured()
    ? '<div class="small muted" style="padding:12px 0">Lock-screen alerts need the push server URL in config.js.</div>'
    : `<div class="toggle"><div class="grow"><b>Lock-screen alerts</b><div class="small muted">${push ? 'On for this phone' : isStandalone() ? 'Get a notification when rest ends' : 'Add to Home Screen first'}${signed ? '' : ' · requires sign-in'}</div></div>
        <button class="btn sm" data-act="${push ? 'push-off' : 'push-on'}">${push ? 'Turn off' : 'Enable'}</button></div>
       ${push ? '<button class="menu-item" data-act="push-test">Send a test alert (5 s)</button>' : ''}`;
  openSheet(`<h2>Settings</h2>
    <h3 style="margin-top:0">Account &amp; sync</h3><div class="set-group">${acct}</div>
    <h3>Program</h3><div class="set-group">
      <label class="field" style="margin:10px 0"><span>Program start date (week 1)</span><input type="date" data-set="startDate" value="${state.settings.startDate || ''}"></label>
      <div class="small muted" style="padding-bottom:12px">Today is week ${weekFor(todayStr())}.</div></div>
    <h3>Rest timer</h3><div class="set-group">
      <label class="toggle"><span class="grow"><b>Sound</b><div class="small muted">Beep when rest ends (ringer switch must be on)</div></span><input type="checkbox" data-pref="sound" ${state.prefs.sound ? 'checked' : ''}></label>
      <label class="toggle"><span class="grow"><b>Keep screen awake</b><div class="small muted">During a workout</div></span><input type="checkbox" data-pref="wake" ${state.prefs.wake ? 'checked' : ''}></label>
      ${pushRow}</div>
    <h3>Data</h3><div class="set-group">
      <button class="menu-item" data-act="export">Export backup (JSON)</button>
      <label class="menu-item" style="cursor:pointer">Import backup<input type="file" accept="application/json,.json" data-act-change="import" hidden></label>
      <button class="menu-item danger" data-act="reset-program">Reset program to the original sheet</button></div>
    <p class="small faint" style="text-align:center;margin-top:18px">Lift Log ${VERSION}</p>`);
}

// ---------- actions ----------
const cur = () => (ui.editingId && state.sessions[ui.editingId]) || activeSession();

function nextLabel(s, i, j) {
  const ex = s.exercises[i];
  const k = ex.sets.findIndex((st, idx) => idx > j && !st.done);
  if (k >= 0) return `${ex.name} · set ${k + 1}`;
  const k2 = ex.sets.findIndex((st) => !st.done);
  if (k2 >= 0) return `${ex.name} · set ${k2 + 1}`;
  for (let n = 1; n < s.exercises.length; n++) {
    const e = s.exercises[(i + n) % s.exercises.length];
    if (!e.skipped && e.sets.some((st) => !st.done)) return e.name;
  }
  return null;
}

async function startDay(day, date) {
  const s = newSession(day, date);
  if (date) { s.finishedAt = null; ui.editingId = s.id; s.startedAt = new Date(parseDate(date).getTime() + 18 * 3600000).toISOString(); }
  else state.activeId = s.id;
  touchSession(s);
  scheduleSync();
  ui.tab = 'train';
  render();
  scrollTo(0, 0);
}

const actions = {
  async start(el) {
    unlockAudio();
    if (activeSession()) return toast('Finish or discard the current workout first');
    await startDay(el.dataset.day);
  },
  'log-past'() {
    openSheet(`<h2>Log a past workout</h2>
      <label class="field"><span>Date</span><input type="date" id="pastDate" value="${todayStr()}" max="${todayStr()}"></label>
      <div class="s-foot">${DAYS.map((d) => `<button class="btn block" data-act="log-past-go" data-day="${d}">${esc(dayTitle(d))}</button>`).join('')}</div>`);
  },
  async 'log-past-go'(el) {
    const date = $('pastDate').value || todayStr();
    closeSheet();
    await startDay(el.dataset.day, date);
  },
  wu(el) {
    const s = cur(); const k = +el.dataset.k;
    s.warmups = s.warmups || [];
    s.warmups[k] = !s.warmups[k];
    touchSession(s); render();
  },
  'set-done'(el) {
    unlockAudio();
    const row = el.closest('.set'); const s = cur();
    const i = +row.dataset.i, j = +row.dataset.j;
    const ex = s.exercises[i], st = ex.sets[j];
    if (st.done) { st.done = false; touchSession(s); rerenderCard(s, i); return; }
    const wIn = row.querySelector('[data-bind="w"]'), rIn = row.querySelector('[data-bind="r"]');
    if (st.w === '' && wIn.placeholder && wIn.placeholder !== 'kg') st.w = wIn.placeholder;
    if (st.r === '' && rIn.placeholder) st.r = rIn.placeholder;
    if (num(st.r) == null || num(st.r) <= 0) { rIn.focus(); return toast('Enter the reps first'); }
    st.done = true; st.t = new Date().toISOString();
    touchSession(s); scheduleSync();
    rerenderCard(s, i);
    if (ui.editingId) return;
    const next = nextLabel(s, i, j);
    if (next) startRest(ex.target.rest || 90, ex.name, next);
    else { stopRest(); toast('All sets done. Finish the workout when ready 💪', 3500); }
  },
  'add-set'(el) {
    const s = cur(), i = +el.dataset.i, ex = s.exercises[i];
    const lastSet = ex.sets[ex.sets.length - 1];
    ex.sets.push({ w: lastSet?.w ?? '', r: '', tr: lastSet?.tr ?? ex.target.repMin, done: false });
    touchSession(s); rerenderCard(s, i);
  },
  'rm-set'(el) {
    const s = cur(), i = +el.dataset.i, ex = s.exercises[i];
    if (ex.sets.length > 1) ex.sets.pop();
    touchSession(s); rerenderCard(s, i);
  },
  'ex-menu'(el) {
    const s = cur(), i = +el.dataset.i, ex = s.exercises[i];
    const item = findItem(s.day, ex.id);
    openSheet(`<h2>${esc(ex.name)}</h2>
      <button class="menu-item" data-act="swap-open" data-i="${i}">${icon('swap')} Swap exercise</button>
      ${item ? `<button class="menu-item" data-act="pin-note" data-i="${i}">${icon('pin')} ${item.myNote ? 'Edit' : 'Add'} pinned note</button>` : ''}
      <button class="menu-item" data-act="skip-ex" data-i="${i}">${icon('skip')} ${ex.skipped ? 'Un-skip' : 'Skip today'}</button>
      <button class="menu-item" data-act="move-ex" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>${icon('up')} Move up</button>
      <button class="menu-item" data-act="move-ex" data-i="${i}" data-d="1" ${i === s.exercises.length - 1 ? 'disabled' : ''}>${icon('down')} Move down</button>
      <button class="menu-item" data-act="ex-progress" data-id="${ex.id}">${icon('chart')} View progress</button>
      <button class="menu-item danger" data-act="remove-ex" data-i="${i}">${icon('trash')} Remove from this workout</button>`);
  },
  'swap-open'(el) {
    const s = cur(), i = +el.dataset.i, ex = s.exercises[i];
    const item = findItem(s.day, ex.id);
    const orig = item?.origName && item.origName !== ex.name ? [item.origName] : [];
    const opts = [...new Set([...orig, ...swapOptions(item?.origName || ex.name), ...swapOptions(ex.name)])].filter((n) => n !== ex.name);
    openSheet(`<h2>Swap ${esc(ex.name)}</h2>
      ${opts.map((n) => `<button class="menu-item" data-act="swap-go" data-i="${i}" data-name="${esc(n)}">${esc(n)}</button>`).join('') || '<p class="muted small">No suggested swaps for this one.</p>'}
      <label class="field"><span>Or type another exercise</span><input id="swapCustom" placeholder="Exercise name"></label>
      <label class="toggle"><span class="grow"><b>Also change it in the program</b><div class="small muted">Off = only for today</div></span><input type="checkbox" id="swapPerm" checked></label>
      <div class="s-foot"><button class="btn primary block" data-act="swap-go" data-i="${i}">Use typed name</button></div>`);
  },
  'swap-go'(el) {
    const name = (el.dataset.name || $('swapCustom').value || '').trim();
    if (!name) return toast('Type an exercise name');
    const perm = $('swapPerm').checked;
    const s = cur(), i = +el.dataset.i, old = s.exercises[i];
    const item = findItem(s.day, old.id);
    const base = item || { cat: old.cat, sets: old.target.sets, repMin: old.target.repMin, repMax: old.target.repMax, rest: old.target.rest, inc: 2.5, start: '' };
    const newItem = { ...base, name, id: exId(s.day, name), start: base.start };
    const ex = buildExercise(newItem, s.date + s.startedAt);
    ex.note = old.note;
    s.exercises[i] = ex;
    if (perm && item) {
      if (!item.origName) item.origName = item.name;
      if (!item.origNotes) item.origNotes = item.notes;
      item.name = name; item.id = newItem.id;
      item.notes = name === item.origName ? item.origNotes : '';
      touchProfile();
    }
    touchSession(s); closeSheet(); render();
    toast(`Swapped to ${name}`);
  },
  'pin-note'(el) {
    const s = cur(), i = +el.dataset.i, item = findItem(s.day, s.exercises[i].id);
    openSheet(`<h2>Pinned note</h2><p class="small muted">Shown on this exercise every workout (seat position, pin number, cues).</p>
      <label class="field"><textarea id="pinTxt">${esc(item.myNote || '')}</textarea></label>
      <div class="s-foot"><button class="btn primary block" data-act="pin-save" data-i="${i}">Save</button></div>`);
  },
  'pin-save'(el) {
    const s = cur(), i = +el.dataset.i, item = findItem(s.day, s.exercises[i].id);
    item.myNote = $('pinTxt').value.trim();
    touchProfile(); scheduleSync(); closeSheet(); render();
  },
  'skip-ex'(el) { const s = cur(), i = +el.dataset.i; s.exercises[i].skipped = !s.exercises[i].skipped; touchSession(s); closeSheet(); render(); },
  'move-ex'(el) {
    const s = cur(), i = +el.dataset.i, d = +el.dataset.d, j = i + d;
    if (j < 0 || j >= s.exercises.length) return;
    [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]];
    touchSession(s); closeSheet(); render();
  },
  'remove-ex'(el) { const s = cur(); s.exercises.splice(+el.dataset.i, 1); touchSession(s); closeSheet(); render(); },
  'ex-progress'(el) { ui.progressEx = el.dataset.id; ui.tab = 'progress'; closeSheet(); render(); scrollTo(0, 0); },
  async finish() {
    const s = activeSession();
    const left = s.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter((x) => !x.done).length), 0);
    if (left && !(await confirmSheet('Finish workout?', `${left} set${left > 1 ? 's are' : ' is'} not ticked and won't be counted.`, 'Finish anyway'))) return;
    s.finishedAt = new Date().toISOString();
    state.activeId = null;
    stopRest();
    touchSession(s); syncNow();
    const st = sessionStats(s);
    const key = s.date + s.startedAt;
    const prs = s.exercises.filter((e) => { const b = bestBefore(e.id, key); return b > 0 && doneSets(e).some((x) => e1rm(num(x.w), num(x.r)) > b); });
    ui.tab = 'history'; ui.historyId = s.id; render(); scrollTo(0, 0);
    openSheet(`<h2>Workout saved 💪</h2>
      <div class="tiles" style="grid-template-columns:repeat(3,1fr)">
        <div class="card tile"><div class="v" style="font-size:22px">${fmtDur(st.dur)}</div><div class="k">Duration</div></div>
        <div class="card tile"><div class="v" style="font-size:22px">${st.sets}</div><div class="k">Sets</div></div>
        <div class="card tile"><div class="v" style="font-size:22px">${fmtVol(st.volume)}</div><div class="k">Volume</div></div></div>
      ${prs.length ? `<h3>New personal records</h3>${prs.map((e) => `<div class="menu-item"><span class="chip pr">PR</span> ${esc(e.name)}</div>`).join('')}` : ''}
      <div class="s-foot"><button class="btn primary block" data-close>Done</button></div>`);
  },
  async discard() {
    if (!(await confirmSheet('Discard workout?', 'Everything logged in this session will be removed.', 'Discard', true))) return;
    const s = activeSession();
    s.deleted = true; state.activeId = null; stopRest();
    touchSession(s); scheduleSync(); render();
  },
  'edit-done'() { const id = ui.editingId; ui.editingId = null; const s = state.sessions[id]; if (!s.finishedAt) { s.finishedAt = s.startedAt; touchSession(s); } scheduleSync(); ui.tab = 'history'; ui.historyId = id; render(); scrollTo(0, 0); },
  'edit-session'(el) { if (activeSession()) return toast('Finish the current workout first'); ui.editingId = el.dataset.id; ui.tab = 'train'; render(); scrollTo(0, 0); },
  async 'delete-session'(el) {
    if (!(await confirmSheet('Delete this workout?', 'It will be removed from history and charts on all devices.', 'Delete', true))) return;
    const s = state.sessions[el.dataset.id];
    s.deleted = true;
    if (ui.editingId === s.id) ui.editingId = null;
    touchSession(s); scheduleSync(); ui.historyId = null; ui.tab = 'history'; render();
  },
  'open-hist'(el) { ui.historyId = el.dataset.id; render(); scrollTo(0, 0); },
  'hist-back'() { ui.historyId = null; render(); },
  'hist-mode'(el) { ui.histMode = el.dataset.m; render(); },
  'grid-day'(el) { ui.gridDay = el.dataset.d; render(); },
  'prog-day'(el) { ui.programDay = el.dataset.d; render(); },
  'p-up'(el) { moveItem(+el.dataset.i, -1); },
  'p-down'(el) { moveItem(+el.dataset.i, 1); },
  'p-edit'(el) {
    const i = +el.dataset.i;
    const it = i >= 0 ? state.program[ui.programDay].items[i] : { name: '', cat: 'MACHINE', sets: 3, repMin: 10, repMax: 12, rest: 90, inc: 2.5, start: '', notes: '' };
    openSheet(`<h2>${i >= 0 ? 'Edit exercise' : 'Add exercise'}</h2><div id="itemForm">${itemForm(it)}</div>
      <div class="s-foot"><button class="btn primary block" data-act="p-save" data-i="${i}">Save</button></div>`);
  },
  'p-save'(el) {
    const i = +el.dataset.i, f = readForm($('itemForm'));
    if (!f.name) return toast('Name is required');
    const d = ui.programDay, items = state.program[d].items;
    const int = (v, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : dflt; };
    const it = i >= 0 ? items[i] : {};
    const repMin = int(f.repMin, 10), repMax = Math.max(repMin, int(f.repMax, repMin));
    Object.assign(it, {
      name: f.name, cat: f.cat, sets: int(f.sets, 3), repMin, repMax, rest: int(f.rest, 90),
      inc: Math.max(0, num(f.inc) ?? 2.5), start: f.start, notes: f.notes, myNote: f.myNote,
    });
    if (!it.id) it.id = exId(d, it.name); // a rename keeps the old id so history stays linked
    if (i < 0) items.push(it);
    touchProfile(); scheduleSync(); closeSheet(); render();
  },
  async 'p-del'(el) {
    const it = state.program[ui.programDay].items[+el.dataset.i];
    if (!(await confirmSheet(`Remove ${it.name}?`, 'Past logs stay in your history and charts.', 'Remove', true))) return;
    state.program[ui.programDay].items.splice(+el.dataset.i, 1);
    touchProfile(); scheduleSync(); closeSheet(); render();
  },
  'p-swap'(el) {
    const i = +el.dataset.i, it = state.program[ui.programDay].items[i];
    const opts = [...new Set([...(it.origName && it.origName !== it.name ? [it.origName] : []), ...swapOptions(it.origName || it.name), ...swapOptions(it.name)])].filter((n) => n !== it.name);
    openSheet(`<h2>Swap ${esc(it.name)}</h2>
      ${opts.map((n) => `<button class="menu-item" data-act="p-swap-go" data-i="${i}" data-name="${esc(n)}">${esc(n)}</button>`).join('') || '<p class="muted small">No suggested swaps.</p>'}
      <label class="field"><span>Or type another exercise</span><input id="swapCustom"></label>
      <div class="s-foot"><button class="btn primary block" data-act="p-swap-go" data-i="${i}">Use typed name</button></div>`);
  },
  'p-swap-go'(el) {
    const name = (el.dataset.name || $('swapCustom').value || '').trim();
    if (!name) return toast('Type an exercise name');
    const it = state.program[ui.programDay].items[+el.dataset.i];
    if (!it.origName) it.origName = it.name;
    if (!it.origNotes) it.origNotes = it.notes;
    it.name = name; it.id = exId(ui.programDay, name);
    it.notes = name === it.origName ? it.origNotes : '';
    touchProfile(); scheduleSync(); closeSheet(); render();
  },
  'day-edit'() {
    const p = state.program[ui.programDay];
    openSheet(`<h2>Edit Day ${ui.programDay}</h2><div id="dayForm">
      <label class="field"><span>Title</span><input name="title" value="${esc(p.title)}"></label>
      <label class="field"><span>Subtitle</span><input name="subtitle" value="${esc(p.subtitle)}"></label></div>
      <div class="s-foot"><button class="btn primary block" data-act="day-save">Save</button></div>`);
  },
  'day-save'() { const f = readForm($('dayForm')); Object.assign(state.program[ui.programDay], f); touchProfile(); scheduleSync(); closeSheet(); render(); },
  'wu-edit'(el) {
    const k = +el.dataset.k, w = k >= 0 ? state.program[ui.programDay].warmups[k] : { name: '', detail: '', notes: '' };
    openSheet(`<h2>${k >= 0 ? 'Edit' : 'Add'} warm-up</h2><div id="wuForm">
      <label class="field"><span>Name</span><input name="name" value="${esc(w.name)}"></label>
      <label class="field"><span>Detail</span><input name="detail" value="${esc(w.detail)}" placeholder="5-7 min"></label>
      <label class="field"><span>Notes</span><textarea name="notes">${esc(w.notes)}</textarea></label></div>
      <div class="s-foot"><button class="btn primary block" data-act="wu-save" data-k="${k}">Save</button>
      ${k >= 0 ? `<button class="btn danger block" data-act="wu-del" data-k="${k}">Remove</button>` : ''}</div>`);
  },
  'wu-save'(el) {
    const k = +el.dataset.k, f = readForm($('wuForm')), list = state.program[ui.programDay].warmups;
    if (!f.name) return toast('Name is required');
    if (k >= 0) Object.assign(list[k], f); else list.push({ cat: 'WARM-UP', ...f });
    touchProfile(); scheduleSync(); closeSheet(); render();
  },
  'wu-del'(el) { state.program[ui.programDay].warmups.splice(+el.dataset.k, 1); touchProfile(); scheduleSync(); closeSheet(); render(); },
  'sheet-ok'() { const r = ui.sheet?.resolve; closeSheet(); r?.(true); },
  'sheet-cancel'() { const r = ui.sheet?.resolve; closeSheet(); r?.(false); },
  async 'sign-in'() { try { await signIn(); } catch (e) { toast(e.message); } },
  async 'sign-out'() {
    if (!(await confirmSheet('Sign out?', 'Your data stays on this phone. Unsynced changes upload the next time you sign in.', 'Sign out'))) return;
    await signOut(); render();
  },
  async 'sync-now'() { await syncNow(); openSettings(); toast(syncStatus.error ? 'Sync failed: ' + syncStatus.error : 'Synced'); },
  async 'push-on'() {
    try { await enablePush(); toast('Lock-screen alerts on'); } catch (e) { toast(e.message, 5000); }
    openSettings();
  },
  async 'push-off'() { await disablePush(); openSettings(); },
  async 'push-test'() { await sendTestPush(); toast('Lock your phone: an alert arrives in ~5 s'); },
  async export() {
    const blob = new Blob([JSON.stringify({ ...state, timer: null }, null, 1)], { type: 'application/json' });
    const file = new File([blob], `liftlog-backup-${todayStr()}.json`, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Lift Log backup' }); } catch {} return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  async 'reset-program'() {
    if (!(await confirmSheet('Reset the program?', 'Exercises, notes and pinned notes go back to the original spreadsheet. Your logged workouts are kept.', 'Reset', true))) return;
    state.program = freshProgram(); touchProfile(); scheduleSync(); render();
  },
};

function moveItem(i, d) {
  const items = state.program[ui.programDay].items, j = i + d;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  touchProfile(); scheduleSync(); render();
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.v !== 1 || !data.sessions) throw new Error('Not a Lift Log backup');
    if (!(await confirmSheet('Import backup?', `${Object.keys(data.sessions).length} workouts. Newer versions of each workout win; the program is replaced.`, 'Import'))) return;
    for (const [id, s] of Object.entries(data.sessions)) {
      const mine = state.sessions[id];
      if (!mine || (s.updatedAt || 0) > (mine.updatedAt || 0)) { state.sessions[id] = s; if (!state.sync.dirty.includes(id)) state.sync.dirty.push(id); }
    }
    if (data.program) state.program = data.program;
    if (data.settings) state.settings = data.settings;
    touchProfile(); scheduleSync(); render(); toast('Backup imported');
  } catch (e) { toast('Import failed: ' + e.message, 4000); }
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const tab = e.target.closest('#tabs [data-tab]');
  if (tab) {
    if (ui.tab === tab.dataset.tab) { ui.historyId = null; scrollTo({ top: 0, behavior: 'smooth' }); }
    ui.tab = tab.dataset.tab; render(); return;
  }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); await fn(el); }
});
$('settingsBtn').addEventListener('click', openSettings);
$('syncBtn').addEventListener('click', openSettings);

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.tagName === 'TEXTAREA') autosize(el);
  const b = el.dataset.bind;
  if (!b) return;
  const s = cur();
  if (!s) return;
  if (b === 'snote') s.note = el.value;
  else if (b === 'exnote') s.exercises[+el.dataset.i].note = el.value;
  else if (b === 'w' || b === 'r') {
    const row = el.closest('.set');
    s.exercises[+row.dataset.i].sets[+row.dataset.j][b] = el.value.replace(',', '.');
  }
  touchSession(s);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.bind === 'w') {
    // Changing a weight carries it forward to the following sets that are not done yet.
    const s = cur(), row = el.closest('.set'), i = +row.dataset.i, j = +row.dataset.j;
    const ex = s.exercises[i];
    ex.sets.forEach((st, k) => {
      if (k > j && !st.done) {
        st.w = ex.sets[j].w;
        const inp = $(`ex-${i}`).querySelector(`.set[data-j="${k}"] [data-bind="w"]`);
        if (inp) inp.value = st.w;
      }
    });
    touchSession(s); scheduleSync();
  } else if (el.dataset.bind === 'sdate') {
    const s = cur(); s.date = el.value || s.date; s.week = weekFor(s.date); touchSession(s); render();
  } else if (el.dataset.bind === 'snote' || el.dataset.bind === 'exnote' || el.dataset.bind === 'r') {
    scheduleSync();
  } else if (el.dataset.set === 'startDate') {
    state.settings.startDate = el.value || null;
    for (const s of liveSessions()) { const w = weekFor(s.date); if (s.week !== w) { s.week = w; touchSession(s); } }
    touchProfile(); scheduleSync(); openSettings(); render();
  } else if (el.dataset.pref) {
    state.prefs[el.dataset.pref] = el.checked; save(); manageWakeLock();
  } else if (el.dataset.actChange === 'import' && el.files[0]) {
    importBackup(el.files[0]);
  } else if (el.id === 'exPick') {
    ui.progressEx = el.value; drawCharts();
  }
});

// Enter on the reps field ticks the set.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset?.bind === 'r') { e.preventDefault(); e.target.blur(); e.target.closest('.set').querySelector('.check').click(); }
});

onChange((kind) => {
  if (kind === 'sync' || kind === 'session' || kind === 'profile') renderSyncIcon();
  if (kind === 'session' || kind === 'profile') scheduleSync();
});

let lastSyncRender = 0;
onChange((kind) => {
  // Re-render after a sync pulls remote changes, but never while the user is typing.
  if (kind !== 'sync' || syncStatus.busy) return;
  if (document.activeElement?.matches('input, textarea') || !$('sheetWrap').hidden) return;
  if (Date.now() - lastSyncRender < 1500) return;
  lastSyncRender = Date.now();
  render();
});
addEventListener('online', renderSyncIcon);
addEventListener('offline', renderSyncIcon);

// ---------- boot ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
resumeTimer();
initSync(() => { renderSyncIcon(); if ($('sheetWrap').hidden) render(); });
