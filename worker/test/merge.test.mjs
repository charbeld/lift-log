// Run: node test/merge.test.mjs   (no network: the OpenAI call is mocked)
import assert from 'node:assert/strict';
import { mergeSession, sessionMinutes } from '../src/coach.js';

const ex = (id, name, cat, sets, repMin, repMax, rest) => ({ id, name, sets, repMin, repMax, rest, cat });
const program = {
  B: { items: [
    ex('B:hack', 'Hack Squat', 'MACHINE', 4, 8, 10, 150),
    ex('B:row', 'Chest Row', 'MACHINE', 4, 10, 12, 150),
    ex('B:curl', 'Leg Curl', 'MACHINE', 3, 10, 12, 150),
    ex('B:lat', 'Lateral Raise', 'FREE', 3, 15, 20, 150),
  ] },
  C: { items: [
    ex('C:press', 'Dips', 'MACHINE', 3, 10, 12, 150),
    ex('C:fly', 'Chest Fly', 'MACHINE', 3, 12, 15, 150),
    ex('C:shrug', 'DB Shrugs', 'MACHINE', 3, 12, 15, 150),
    ex('C:crunch', 'Pallof', 'CORE', 3, 12, 15, 150),
  ] },
};
const fakeModel = (body) => async () => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(body) } }],
}), { status: 200 });

// 1. The budget is enforced in code: all 8 exercises at full sets are far over 90 minutes.
const everything = { summary: 'Both days.', exercises: Object.values(program).flatMap((d) => d.items).map((it) => ({ key: it.id, sets: 4, rationale: 'keep [S2]' })) };
const big = await mergeSession({ OPENAI_API_KEY: 'x' }, [], program, ['B'], 'C', fakeModel(everything));
assert.ok(big.minutes <= 90, `fits 90 minutes, got ${big.minutes}`);
assert.ok(big.exercises.length < 8, 'exercises are dropped to fit');
assert.equal(sessionMinutes(big.exercises.map((e) => ({ sets: e.sets, rest: e.rest }))) <= 90, true);
const order = everything.exercises.map((e) => e.key);
assert.deepEqual(big.exercises.map((e) => e.key), order.slice(0, big.exercises.length), 'trimming drops from the end of the model order');
assert.equal(big.explained, true);

// 2. The model may only pick real keys, and cannot raise sets above the target or drop them below 2.
const odd = await mergeSession({ OPENAI_API_KEY: 'x' }, [], program, ['B'], 'C', fakeModel({
  summary: 's',
  exercises: [
    { key: 'nope', sets: 3, rationale: 'x' },
    { key: 'B:hack', sets: 9, rationale: 'r [S2]' },
    { key: 'B:hack', sets: 2, rationale: 'dup' },
    { key: 'C:fly', sets: 1, rationale: 'r' },
  ],
}));
assert.deepEqual(odd.exercises.map((e) => [e.key, e.sets]), [['B:hack', 4], ['C:fly', 2]]);
assert.equal(odd.exercises[0].w, null, 'no history means no weight from the rules');

// 3. If the model is down, the session is still built from the rules and trimmed to the budget.
const down = await mergeSession({ OPENAI_API_KEY: 'x' }, [], program, ['B'], 'C', async () => new Response('no', { status: 500 }));
assert.equal(down.explained, false);
assert.ok(down.minutes <= 90);
assert.equal(down.exercises[0].rationale, down.exercises[0].rationale.slice(0, 400));

// 4. A small session is not trimmed at all.
const small = await mergeSession({ OPENAI_API_KEY: 'x' }, [], program, ['C'], 'C', fakeModel({
  summary: 's', exercises: [{ key: 'C:fly', sets: 3, rationale: 'r' }],
}));
assert.equal(small.exercises.length, 1);
assert.equal(small.minutes, Math.round(sessionMinutes([{ sets: 3, rest: 150 }])));

// 5. The model gets the whole library with roles and muscles, and may use a lift from a day that is not owed or due.
const withA = { ...program, A: { items: [ex('A:bench', 'Bench Press (Smith or DB)', 'MACHINE', 4, 8, 10, 150)] } };
let sent = null;
const libModel = async (url, opts) => { sent = JSON.parse(opts.body); return fakeModel({ summary: 's', exercises: [{ key: 'A:bench', sets: 3, rationale: 'chest [S2]' }, { key: 'B:hack', sets: 4, rationale: 'legs [S2]' }] })(); };
const lib = await mergeSession({ OPENAI_API_KEY: 'x' }, [], withA, ['B'], 'C', libModel);
const payload = JSON.parse(sent.messages[1].content);
assert.deepEqual(payload.library.map((e) => e.role).filter((r, i, a) => a.indexOf(r) === i), ['due', 'owed', 'library'], 'roles: due, owed, then library');
assert.equal(payload.library.find((e) => e.key === 'A:bench').muscles, 'chest, triceps, front delts', 'muscles come from the knowledge base');
assert.equal(payload.library.find((e) => e.key === 'B:hack').pattern, 'squat', 'each lift carries its movement pattern');
assert.match(sent.messages[0].content, /Program knowledge for building one combined session/, 'program rules are in the system prompt');
assert.deepEqual(lib.exercises.map((e) => e.key), ['A:bench', 'B:hack'], 'a library lift from another day is accepted');

// 6. Without the model, only the owed and due days are used.
const fb = await mergeSession({ OPENAI_API_KEY: 'x' }, [], withA, ['B'], 'C', async () => new Response('no', { status: 500 }));
assert.ok(fb.exercises.every((e) => e.day !== 'A'), 'fallback uses owed and due days only');

console.log('merge tests passed');
