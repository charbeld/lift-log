// AI coach: reads a user's workout history, asks an OpenAI model for next-session targets grounded in
// the research in knowledge.js, then clamps every number so the model cannot invent or overreach.
import { KNOWLEDGE, SOURCES, SOURCE_IDS } from './knowledge.js';

const MODEL = 'gpt-4.1-mini'; // the model used in the other projects (structured JSON work)
const TIMEOUT_MS = 25000;
const MAX_EXERCISES = 40;
const HISTORY_SESSIONS = 6;
const ACTIONS = ['increase', 'hold', 'reps', 'reduce'];

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const e1rm = (w, r) => (!w || !r ? 0 : r === 1 ? w : w * (1 + r / 30));
const exKey = (id) => String(id).replace(/^[ABC]:/, '');
const doneSets = (ex) => (ex.sets || []).filter((st) => st.done && num(st.r) != null);
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

// One slot per program item (exercise + day, key = item id), since the same exercise can have a different
// rep range on each day. The history of an exercise is shared across days by its name (exKey).
export function buildHistory(workouts, program) {
  const sessions = workouts
    .filter((s) => s && !s.deleted && s.finishedAt)
    .sort((a, b) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt));
  const perf = new Map(); // exKey -> performances, oldest first
  for (const s of sessions) {
    for (const ex of s.exercises || []) {
      const done = doneSets(ex);
      if (!done.length) continue;
      const k = exKey(ex.id);
      if (!perf.has(k)) perf.set(k, []);
      perf.get(k).push({
        date: s.date, week: s.week, day: s.day,
        target: ex.target ? { sets: ex.target.sets, repMin: ex.target.repMin, repMax: ex.target.repMax } : null,
        sets: done.map((st) => ({ w: num(st.w) || 0, r: num(st.r) })),
      });
    }
  }
  const slots = [];
  for (const day of Object.keys(program || {})) {
    for (const it of program[day].items || []) {
      const p = perf.get(exKey(it.id)) || [];
      const recent = p.slice(-HISTORY_SESSIONS);
      const last = recent[recent.length - 1];
      slots.push({
        key: it.id, name: it.name, day, inc: it.inc ?? 2.5,
        target: { sets: it.sets, repMin: it.repMin, repMax: it.repMax, rest: it.rest },
        lastTop: last ? Math.max(...last.sets.map((x) => x.w)) : null,
        history: recent.map((x) => ({
          date: x.date, week: x.week, day: x.day, target: x.target,
          sets: x.sets.map((y) => `${fmt(y.w)}kg x ${y.r ?? '-'}`).join(', '),
        })),
      });
    }
  }
  return slots.slice(0, MAX_EXERCISES);
}

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'exercises'],
  properties: {
    summary: { type: 'string' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'action', 'weight_kg', 'reps', 'rationale', 'sources'],
        properties: {
          key: { type: 'string' },
          action: { type: 'string', enum: ACTIONS },
          weight_kg: { type: ['number', 'null'] },
          reps: { type: 'array', items: { type: 'integer' } },
          rationale: { type: 'string' },
          sources: { type: 'array', items: { type: 'string', enum: SOURCE_IDS } },
        },
      },
    },
  },
};

const SYSTEM = `You are a strength coach that plans the next session for each exercise in a lifter's app.
You receive one entry per exercise per program day (key = its id, with that day's target). The same exercise can appear on
several days with different rep ranges (sometimes as a main lift, sometimes as an accessory). Its history from all days is
included, but judge progression only from sessions done in the same rep range as this entry's target (see H1).
Plan this entry's next session against its own target.

Progression rules (use the sources cited in the research notes):
- increase: every set of the most recent matching session reached repMax at lastTop kg. Next: weight_kg = lastTop + inc, reps = repMin per set.
- reps: sets did not all reach repMax. Keep lastTop kg and add one rep per set (capped at repMax).
- hold: performance slipped or is unclear. Keep the same weight and reps.
- reduce: reps dropped at the same weight for two sessions in a row. Lower weight_kg by about 5-10%.
- No matching history: weight_kg null, reps at repMin, action hold, and say in rationale that there is no history for this range.
Never invent numbers that are not supported by the history. Keep rationale to one or two short sentences that name the
data used. List only source ids from the research notes that you actually relied on.

Research notes:
${KNOWLEDGE}

Reply with JSON only, matching the schema.`;

const round = (x, step) => Math.round(x / step) * step;

// The model proposes; this decides what the app is allowed to show.
export function clampPlan(raw, exercises) {
  const out = [];
  for (const ex of exercises) {
    const r = (raw?.exercises || []).find((e) => e.key === ex.key);
    if (!r) continue;
    const step = ex.inc > 0 ? ex.inc : 2.5;
    const top = ex.lastTop;
    let w = null;
    if (top != null) {
      if (Number.isFinite(r.weight_kg)) {
        const lo = top * 0.85, hi = top + Math.max(2 * step, 0.1 * top);
        w = +round(Math.min(hi, Math.max(lo, r.weight_kg)), step).toFixed(2);
      } else {
        w = top;
      }
    }
    const { sets, repMin, repMax } = ex.target;
    const n = sets > 0 ? sets : 3;
    const reps = Array.from({ length: n }, (_, i) => {
      const v = Number.isFinite(r.reps?.[i]) ? Math.round(r.reps[i]) : repMin;
      return Math.min(repMax, Math.max(repMin, v));
    });
    out.push({
      key: ex.key, name: ex.name,
      action: ACTIONS.includes(r.action) ? r.action : 'hold',
      w, reps,
      rationale: String(r.rationale || '').slice(0, 300),
      sources: SOURCES.filter((s) => (r.sources || []).includes(s.id)).map(({ id, title, url }) => ({ id, title, url })),
    });
  }
  return { summary: String(raw?.summary || '').slice(0, 400), exercises: out };
}

export async function askCoach(env, input, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || MODEL,
        temperature: 0.2,
        max_completion_tokens: 2500, // a cap stops runaway JSON output (see LEARNING.md, gpt-4.1-mini runaway)
        response_format: { type: 'json_schema', json_schema: { name: 'coach_plan', strict: true, schema: PLAN_SCHEMA } },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(input) }],
      }),
    });
    if (!res.ok) throw new Error(`coach model HTTP ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('coach model returned nothing');
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

export async function recommend(env, workouts, program, fetchImpl) {
  const exercises = buildHistory(workouts, program);
  if (!exercises.length) return { summary: 'No finished workouts yet. Log a session first.', exercises: [], at: Date.now() };
  const raw = await askCoach(env, { exercises }, fetchImpl);
  return { ...clampPlan(raw, exercises), at: Date.now() };
}
