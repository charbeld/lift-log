// Run: node test/coach.test.mjs   (no network: the OpenAI call is mocked)
import assert from 'node:assert/strict';
import { buildHistory, clampPlan, recommend } from '../src/coach.js';
import { SOURCE_IDS } from '../src/knowledge.js';

const program = {
  A: { items: [{ id: 'A:leg-extension', name: 'Leg Extension', sets: 3, repMin: 12, repMax: 15, rest: 60, inc: 2.5 }] },
  C: { items: [{ id: 'C:leg-extension', name: 'Leg Extension', sets: 3, repMin: 15, repMax: 20, rest: 45, inc: 2.5 }] },
};
const sess = (id, day, date, sets, target) => ({
  id, day, date, week: 1, startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z`, updatedAt: 1, deleted: false,
  exercises: [{ id: `${day}:leg-extension`, name: 'Leg Extension', target, sets: sets.map(([w, r]) => ({ w: String(w), r: String(r), done: true })) }],
});
const workouts = [
  sess('s1', 'A', '2026-09-02', [[20, 15], [20, 15], [20, 15]], { sets: 3, repMin: 12, repMax: 15, rest: 60 }),
  sess('s2', 'C', '2026-09-05', [[20, 18], [20, 17], [20, 16]], { sets: 3, repMin: 15, repMax: 20, rest: 45 }),
  { ...sess('s3', 'A', '2026-09-09', [[99, 9]], { sets: 3, repMin: 12, repMax: 15, rest: 60 }), deleted: true },
];

// 1. One slot per program day, history shared across days by exercise name, deleted sessions ignored.
const hist = buildHistory(workouts, program);
const A = hist.find((s) => s.key === 'A:leg-extension');
const C = hist.find((s) => s.key === 'C:leg-extension');
assert.equal(hist.length, 2, 'one slot per program item');
assert.equal(A.target.repMax, 15, 'Day A slot keeps its own range');
assert.equal(C.target.repMax, 20, 'Day C slot keeps its own range');
assert.equal(C.history.length, 2, 'history from both days is shared');
assert.equal(C.lastTop, 20);
assert.equal(C.history[0].target.repMin, 12, 'each performance keeps the range it was done under');

// 2. Clamping against the slot's own target: no invented weight, bounded jump, reps inside that slot's range.
const wild = clampPlan({ summary: 's', exercises: [{ key: C.key, action: 'increase', weight_kg: 80, reps: [30, 2, 14], rationale: 'r', sources: ['S1', 'XX'] }] }, [C]);
assert.equal(wild.exercises[0].w, 25, 'weight capped at top + max(2 steps, 10%) = 20 + 5');
assert.deepEqual(wild.exercises[0].reps, [20, 15, 15], 'reps clamped into [15,20] per set (30→20, 2→15, 14→15)');
assert.deepEqual(wild.exercises[0].sources.map((s) => s.id), ['S1'], 'unknown source ids are dropped');
assert.match(wild.exercises[0].sources[0].title, /Plotkin/, 'sources come back with their titles');
assert.ok(SOURCE_IDS.includes('S1'));

const low = clampPlan({ exercises: [{ key: C.key, action: 'reduce', weight_kg: 1, reps: [], rationale: '', sources: [] }] }, [C]);
assert.equal(low.exercises[0].w, 17.5, 'a reduce cannot drop more than 15% in one step (20 → 17 floor, rounded to 2.5 kg)');
assert.equal(low.exercises[0].reps.join(), '15,15,15', 'missing reps default to the slot range minimum');

const other = clampPlan({ exercises: [{ key: 'nope', action: 'hold', weight_kg: 50, reps: [], rationale: '', sources: [] }] }, [C]);
assert.equal(other.exercises.length, 0, 'a key not in the input is ignored');
const fresh = { key: 'B:x', name: 'X', inc: 2.5, lastTop: null, target: { sets: 3, repMin: 8, repMax: 10 } };
assert.equal(clampPlan({ exercises: [{ key: 'B:x', action: 'increase', weight_kg: 40, reps: [], rationale: '', sources: [] }] }, [fresh]).exercises[0].w, null, 'no history means no invented weight');
assert.equal(clampPlan({ action: 'nonsense' }, []).exercises.length, 0);

// 3. End to end with a mocked OpenAI response: the request is well formed and the plan is clamped.
let sent;
const fakeFetch = async (url, init) => {
  sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
  const content = JSON.stringify({ summary: 'Keep building.', exercises: [{ key: C.key, action: 'reps', weight_kg: 20, reps: [16, 16, 16], rationale: 'Two sessions at 20 kg; add a rep.', sources: ['S2', 'H1'] }] });
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
};
const plan = await recommend({ OPENAI_API_KEY: 'sk-test' }, workouts, program, fakeFetch);
assert.equal(sent.url, 'https://api.openai.com/v1/chat/completions');
assert.equal(sent.auth, 'Bearer sk-test');
assert.equal(sent.body.model, 'gpt-4.1-mini');
assert.equal(sent.body.response_format.type, 'json_schema');
assert.ok(sent.body.max_completion_tokens <= 4000, 'output is capped');
assert.match(sent.body.messages[0].content, /\[S1\]/, 'research notes are in the prompt');
assert.equal(plan.exercises[0].key, 'C:leg-extension');
assert.equal(plan.exercises[0].w, 20);
assert.deepEqual(plan.exercises[0].reps, [16, 16, 16]);
assert.deepEqual(plan.exercises[0].sources.map((s) => s.id), ['S2', 'H1']);

// 4. A model error surfaces as an error, never as a made-up plan.
await assert.rejects(recommend({ OPENAI_API_KEY: 'x' }, workouts, program, async () => new Response('no', { status: 500 })), /HTTP 500/);

console.log('coach tests passed');
