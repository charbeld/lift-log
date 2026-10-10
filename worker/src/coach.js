// AI coach. The numbers are computed here from the lifter's logs with fixed rules (double progression, plus a
// conservative conversion for a new rep range). The model only explains each plan, citing the research notes.
import { KNOWLEDGE, SOURCES, SOURCE_IDS } from './knowledge.js';

const MODEL = 'gpt-4.1-mini'; // the model used in the other projects (structured JSON work)
const TIMEOUT_MS = 25000;
const MAX_SLOTS = 40;
const HISTORY = 6;
const ACTIONS = ['increase', 'reps', 'hold', 'reduce'];

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const e1rm = (w, r) => (!w || !r ? 0 : r === 1 ? w : w * (1 + r / 30));
const exKey = (id) => String(id).replace(/^[ABC]:/, '');
const doneSets = (ex) => (ex.sets || []).filter((st) => st.done && num(st.r) != null);
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const roundTo = (x, step) => +(Math.round(x / step) * step).toFixed(2);
const sameRange = (a, b) => !!a && !!b && a.repMin === b.repMin && a.repMax === b.repMax;
const setText = (s) => `${fmt(s.w)} kg x ${s.r ?? '-'}`;

// One slot per program item (exercise + day, key = item id). Its performances are the same exercise's sessions
// from every day, oldest first, so a lift done on two days shares one history.
export function buildHistory(workouts, program) {
  const sessions = workouts
    .filter((s) => s && !s.deleted && s.finishedAt)
    .sort((a, b) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt));
  const perf = new Map();
  for (const s of sessions) {
    for (const ex of s.exercises || []) {
      const done = doneSets(ex);
      if (!done.length) continue;
      const k = exKey(ex.id);
      if (!perf.has(k)) perf.set(k, []);
      perf.get(k).push({
        date: s.date, day: s.day,
        target: ex.target ? { sets: ex.target.sets, repMin: ex.target.repMin, repMax: ex.target.repMax } : null,
        sets: done.map((st) => ({ w: num(st.w) || 0, r: num(st.r) })),
      });
    }
  }
  const slots = [];
  for (const day of Object.keys(program || {})) {
    for (const it of program[day].items || []) {
      slots.push({
        key: it.id, name: it.name, day, inc: it.inc ?? 2.5,
        target: { sets: it.sets, repMin: it.repMin, repMax: it.repMax, rest: it.rest },
        perf: (perf.get(exKey(it.id)) || []).slice(-HISTORY),
      });
    }
  }
  return slots.slice(0, MAX_SLOTS);
}

const rangeText = (t) => (t ? `${t.repMin}–${t.repMax} reps` : 'unknown range');
const rule = (action, w, reps, basis, sources, facts) => ({ action, w, reps, basis, sources, facts });

// The plan for one slot, from its own rep range. Returns the action, weight, reps, and the facts it was based on.
export function computeRule(slot) {
  const { sets: n, repMin, repMax } = slot.target;
  const count = n > 0 ? n : 3;
  const step = slot.inc > 0 ? slot.inc : 2.5;
  const minReps = Array(count).fill(repMin);
  const last = slot.perf[slot.perf.length - 1];
  const same = slot.perf.filter((p) => sameRange(p.target, slot.target));

  if (!last) {
    return rule('hold', null, minReps, 'none', ['H1'],
      `No logged sessions for ${slot.name} yet, so there is nothing to progress from. Start at ${repMin} reps and pick a weight you can control for the whole range.`);
  }
  if (!same.length) {
    // No session in this rep range yet: convert the best set of the last session with the Epley estimate, then go 5% lower.
    const best = last.sets.reduce((a, s) => (e1rm(s.w, s.r) > e1rm(a.w, a.r) ? s : a), last.sets[0]);
    const est = e1rm(best.w, best.r);
    const w = roundTo((est / (1 + repMin / 30)) * 0.95, step);
    return rule('hold', w || null, minReps, 'converted', ['H1', 'S1'],
      `No session yet in ${repMin}–${repMax} reps. Last session ${last.date} was ${rangeText(last.target)}; its best set was ${setText(best)}, an estimated 1RM of ${fmt(roundTo(est, 0.5))} kg. Converted to ${repMin} reps and taken 5% lower: ${fmt(w)} kg.`);
  }

  const cur = same[same.length - 1];
  const T = Math.max(...cur.sets.map((s) => s.w));
  const top = cur.sets.filter((s) => s.w === T);
  const weightOut = T > 0 ? T : null;
  const lastTxt = `Last session in ${repMin}–${repMax} reps (${cur.date}): ${cur.sets.map(setText).join(', ')}.`;

  // Double progression: every set at the top weight reached the top of the range.
  if (slot.inc > 0 && top.length >= count && top.every((s) => s.r >= repMax)) {
    const next = T + step;
    return rule('increase', next, minReps, 'same-range', ['S2', 'S4', 'S1'],
      `${lastTxt} All ${count} sets at ${fmt(T)} kg reached ${repMax} reps, so the weight goes up by ${fmt(step)} kg to ${fmt(next)} kg and reps reset to ${repMin}.`);
  }

  // Two sessions in a row with fewer total reps at the same weight: back off.
  const three = same.slice(-3);
  if (three.length === 3 && three.every((p) => Math.max(...p.sets.map((s) => s.w)) === T)) {
    const reps3 = three.map((p) => sum(p.sets.map((s) => s.r)));
    if (reps3[0] > reps3[1] && reps3[1] > reps3[2]) {
      const w = roundTo(T * 0.9, step);
      return rule('reduce', w || null, minReps, 'same-range', ['H1'],
        `${lastTxt} Total reps at ${fmt(T)} kg fell for two sessions in a row (${reps3.join(' → ')}), so the weight comes down about 10% to ${fmt(w)} kg.`);
    }
  }

  // Mixed weights last time (the top weight was not used for every set): nothing to progress from yet.
  if (top.length < count) {
    return rule('hold', weightOut, minReps, 'same-range', ['S2'],
      `${lastTxt} Only ${top.length} of ${count} sets were done at the top weight ${fmt(T)} kg, so no progression is applied yet. Keep ${fmt(T)} kg and aim to do every set at it.`);
  }

  // A set below the bottom of the range: keep the weight and work back to the range.
  if (top.some((s) => s.r < repMin)) {
    return rule('hold', weightOut, minReps, 'same-range', ['S2'],
      `${lastTxt} A set at ${fmt(T)} kg fell below ${repMin} reps, so the weight stays at ${fmt(T)} kg until every set reaches ${repMin}.`);
  }

  // Otherwise: same weight, one more rep per set (capped at the top of the range).
  const reps = Array.from({ length: count }, (_, i) => {
    const base = (top[i] ?? top[top.length - 1] ?? cur.sets[cur.sets.length - 1]).r;
    return Math.min(repMax, Math.max(repMin, base + 1));
  });
  return rule('reps', weightOut, reps, 'same-range', ['S2', 'S3', 'S1'],
    `${lastTxt} Not every set reached ${repMax} at ${fmt(T)} kg yet, so the weight stays and each set adds one rep, aiming for ${reps.join(' / ')}.`);
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

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
        required: ['key', 'rationale'],
        properties: {
          key: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM = `You explain strength plans for a lifter's app. For each exercise you get its computed plan: the action,
weight_kg, reps, and the facts from the lifter's logs that the rule used. These numbers are final. Do not change,
recalculate, or question them.

For each exercise, write a rationale of one or two plain sentences that:
- restates the facts exactly as given (dates, weights, reps, rep range), and
- names the research that supports the action, citing its id from the notes below (for example [S2]). Use only ids that appear in the notes.

Keep the summary to one or two sentences about the session as a whole. Reply with JSON only, matching the schema.

Research notes:
${KNOWLEDGE}`;

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
        response_format: { type: 'json_schema', json_schema: { name: 'coach_explanations', strict: true, schema: PLAN_SCHEMA } },
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

// Combines the computed plans with the model's explanations. The model supplies text only; if it is missing,
// the facts stand in as the rationale.
export function assemble(rules, raw) {
  const byKey = new Map((raw?.exercises || []).map((e) => [e.key, e]));
  return {
    summary: String(raw?.summary || 'Next-session targets from your logged sessions.').slice(0, 400),
    exercises: rules.map(({ slot, rule: r }) => {
      const text = byKey.get(slot.key)?.rationale;
      return {
        key: slot.key, name: slot.name,
        action: ACTIONS.includes(r.action) ? r.action : 'hold',
        w: r.w, reps: r.reps,
        facts: r.facts,
        rationale: String(text || r.facts).slice(0, 400),
        sources: SOURCES.filter((s) => r.sources.includes(s.id) && SOURCE_IDS.includes(s.id)).map(({ id, title, url }) => ({ id, title, url })),
      };
    }),
  };
}

export async function recommend(env, workouts, program, fetchImpl) {
  const slots = buildHistory(workouts, program);
  const at = Date.now();
  if (!slots.length) return { summary: 'No program yet. Sync your program first.', exercises: [], at, explained: false };
  const rules = slots.map((slot) => ({ slot, rule: computeRule(slot) }));
  let raw = null;
  let explained = true;
  try {
    raw = await askCoach(env, {
      exercises: rules.map(({ slot, rule: r }) => ({
        key: slot.key, name: slot.name, day: slot.day, target: slot.target,
        action: r.action, weight_kg: r.w, reps: r.reps, facts: r.facts,
      })),
    }, fetchImpl);
  } catch (e) {
    explained = false; // the plan itself is still computed from the logs
    console.log('coach explanation unavailable', e.message);
  }
  return { ...assemble(rules, raw), at, explained };
}
