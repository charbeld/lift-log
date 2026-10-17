// Run: node test/coach.test.mjs   (no network: the OpenAI call is mocked)
import assert from 'node:assert/strict';
import { buildHistory, computeRule, assemble, recommend } from '../src/coach.js';

const R = { sets: 3, repMin: 12, repMax: 15, rest: 60 };
const slot = (perf, over = {}) => ({ key: 'C:leg-extension', name: 'Leg Extension', day: 'C', inc: 2.5, target: R, perf, ...over });
const perf = (sets, target = R, date = '2026-09-05') => ({ date, day: 'C', target, sets: sets.map(([w, r]) => ({ w, r })) });

// 1. History: one slot per program item, shared across days by name, deleted sessions ignored.
const program = {
  A: { items: [{ id: 'A:leg-extension', name: 'Leg Extension', sets: 3, repMin: 12, repMax: 15, rest: 60, inc: 2.5 }] },
  C: { items: [{ id: 'C:leg-extension', name: 'Leg Extension', sets: 3, repMin: 15, repMax: 20, rest: 45, inc: 2.5 }] },
};
const sess = (id, day, date, sets, target, extra = {}) => ({
  id, day, date, week: 1, startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z`, updatedAt: 1, deleted: false, ...extra,
  exercises: [{ id: `${day}:leg-extension`, name: 'Leg Extension', target, sets: sets.map(([w, r]) => ({ w: String(w), r: String(r), done: true })) }],
});
const workouts = [
  sess('s1', 'A', '2026-09-02', [[20, 15], [20, 15], [20, 15]], { sets: 3, repMin: 12, repMax: 15, rest: 60 }),
  sess('s2', 'C', '2026-09-05', [[20, 18], [20, 17], [20, 16]], { sets: 3, repMin: 15, repMax: 20, rest: 45 }),
  sess('s3', 'A', '2026-09-09', [[99, 9]], { sets: 3, repMin: 12, repMax: 15, rest: 60 }, { deleted: true }),
];
const slots = buildHistory(workouts, program);
const A = slots.find((s) => s.key === 'A:leg-extension');
const C = slots.find((s) => s.key === 'C:leg-extension');
assert.equal(slots.length, 2, 'one slot per program item');
assert.equal(A.target.repMax, 15, 'Day A keeps its own range');
assert.equal(C.target.repMax, 20, 'Day C keeps its own range');
assert.equal(C.perf.length, 2, 'history from both days is shared, deleted sessions excluded');
assert.equal(C.perf[1].sets[0].w, 20, 'performances are numeric');

// 2. Rules, one case each.
const none = computeRule(slot([]));
assert.equal(none.action, 'hold'); assert.equal(none.w, null); assert.equal(none.basis, 'none');

const conv = computeRule(slot([perf([[20, 15]], { sets: 3, repMin: 15, repMax: 20, rest: 45 })]));
assert.equal(conv.basis, 'converted');
assert.equal(conv.w, 20, 'e1RM 30 → 30 / (1 + 12/30) × 0.95 ≈ 20.4 → 20 kg');
assert.deepEqual(conv.reps, [12, 12, 12]);
assert.match(conv.facts, /estimated 1RM of 30 kg/);

const inc = computeRule(slot([perf([[20, 15], [20, 15], [20, 15]])]));
assert.equal(inc.action, 'increase'); assert.equal(inc.w, 22.5); assert.deepEqual(inc.reps, [12, 12, 12]);
assert.ok(inc.sources.includes('S2'), 'increase cites double progression');
assert.match(inc.facts, /reached 15 reps/);

const reps = computeRule(slot([perf([[20, 12], [20, 12], [20, 12]])]));
assert.equal(reps.action, 'reps'); assert.equal(reps.w, 20); assert.deepEqual(reps.reps, [13, 13, 13]);

const below = computeRule(slot([perf([[20, 11], [20, 12], [20, 12]])]));
assert.equal(below.action, 'hold'); assert.equal(below.w, 20); assert.deepEqual(below.reps, [12, 12, 12]);

const down = computeRule(slot([
  perf([[20, 13], [20, 13], [20, 12]], R, '2026-09-01'),
  perf([[20, 13], [20, 12], [20, 12]], R, '2026-09-04'),
  perf([[20, 12], [20, 12], [20, 11]], R, '2026-09-08'),
]));
assert.equal(down.action, 'reduce', 'total reps fell two sessions running at the same weight');
assert.equal(down.w, 17.5, '20 kg × 0.9 = 18 → rounded to 2.5 kg steps = 17.5');

const mixed = computeRule(slot([perf([[60, 12], [60, 12], [70, 15]])]));
assert.equal(mixed.action, 'hold', 'only one set at the top weight: no progression');
assert.equal(mixed.w, 70);
assert.deepEqual(mixed.reps, [12, 12, 12]);
assert.match(mixed.facts, /Only 1 of 3 sets/);

const noInc = computeRule(slot([perf([[20, 15], [20, 15], [20, 15]])], { inc: 0 }));
assert.equal(noInc.action, 'reps', 'a lift with no weight step never increases');
assert.deepEqual(noInc.reps, [15, 15, 15], 'reps stay capped at the top of the range');

// 3. recommend(): numbers come from the rules, even if the model tries to change them.
const program2 = { C: { items: [program.C.items[0]] } };
let sent;
const fakeFetch = async (url, init) => {
  sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
  const content = JSON.stringify({
    summary: 'Keep building.',
    exercises: [{ key: 'C:leg-extension', rationale: 'Three sets at 20 kg reached 20 reps. Double progression [S2] supports the increase.' }],
  });
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
};
const plan = await recommend({ OPENAI_API_KEY: 'sk-test' }, workouts, program2, fakeFetch);
assert.equal(sent.url, 'https://api.openai.com/v1/chat/completions');
assert.equal(sent.auth, 'Bearer sk-test');
assert.equal(sent.body.model, 'gpt-6-luna');
assert.equal(sent.body.response_format.type, 'json_schema');
assert.ok(sent.body.max_completion_tokens <= 4000);
assert.match(sent.body.messages[0].content, /\[S1\]/, 'research notes are in the prompt');
const sentEx = sent.body.messages[1].content;
assert.match(sentEx, /weight_kg/, 'the computed numbers are sent to the model');
assert.equal(plan.explained, true);
const ex = plan.exercises[0];
assert.equal(ex.key, 'C:leg-extension');
assert.equal(ex.action, 'reps', 'C range 15–20, last 20 kg × 18/17/16: not all at 20 → add a rep');
assert.equal(ex.w, 20);
assert.deepEqual(ex.reps, [19, 18, 17], 'each set adds one rep from its own last rep');
assert.match(ex.facts, /20 kg x 18, 20 kg x 17, 20 kg x 16/, 'facts quote the logged sets');
assert.match(ex.rationale, /\[S2\]/, 'the model explanation is kept');
assert.ok(ex.sources.some((s) => s.id === 'S2' && s.title), 'sources come back with titles');

// 4. The model's explanation is text only: a made-up weight is ignored.
const liar = await recommend({ OPENAI_API_KEY: 'x' }, workouts, program2, async () => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify({ summary: 's', exercises: [{ key: 'C:leg-extension', rationale: 'r', weight_kg: 999 }] }) } }],
}), { status: 200 }));
assert.equal(liar.exercises[0].w, 20, 'weight comes from the rules, not the model');

// 5. If the model is down, the plan is still computed and says the explanation is missing.
const down500 = await recommend({ OPENAI_API_KEY: 'x' }, workouts, program2, async () => new Response('no', { status: 500 }));
assert.equal(down500.explained, false);
assert.equal(down500.exercises[0].action, 'reps', 'the plan does not depend on the model');
assert.equal(down500.exercises[0].rationale, down500.exercises[0].facts, 'facts stand in for the explanation');

// 6. Unknown keys from the model are ignored.
const stray = assemble([{ slot: slot([]), rule: computeRule(slot([])) }], { summary: 's', exercises: [{ key: 'nope', rationale: 'x' }] });
assert.equal(stray.exercises[0].rationale, stray.exercises[0].facts);

console.log('coach tests passed');
