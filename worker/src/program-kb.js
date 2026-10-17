// Knowledge base for building a combined session from the lifter's own exercise library. The library itself
// (names, sets, rep ranges, rest, cues) comes from the lifter's synced program; this file adds what the program
// does not say: what each day is for, which muscles each lift works, and the rules for putting two days together.

export const DAY_FOCUS = {
  A: 'Push: chest, quads, shoulders, plus pulling (lats, mid-back). Main lifts: leg press, bench press.',
  B: 'Pull: back, hamstrings, glutes, plus pushing. Main lifts: hack squat, chest-supported row.',
  C: 'Mix: different angles and weak points, pump work. Main lifts: leg press (narrow), dips, cable row (wide).',
};

// First match wins, so the more specific names come first.
const MUSCLE_MAP = [
  ['hack squat', 'quads, glutes'],
  ['leg press', 'quads, glutes'],
  ['leg extension', 'quads'],
  ['leg curl', 'hamstrings'],
  ['back extension', 'lower back, glutes, hamstrings'],
  ['incline', 'upper chest, front delts'],
  ['bench press', 'chest, triceps, front delts'],
  ['chest fly', 'chest'],
  ['dips', 'chest, triceps'],
  ['pulldown', 'lats, biceps'],
  ['row', 'mid-back, lats, rear delts'],
  ['overhead press', 'shoulders, triceps'],
  ['lateral raise', 'side delts'],
  ['shrug', 'upper traps'],
  ['pushdown', 'triceps'],
  ['bicep curl', 'biceps'],
  ['crunch', 'abs'],
  ['pallof', 'abs, obliques'],
  ['leg raise', 'abs, hip flexors'],
];

export const musclesFor = (name) => {
  const n = String(name).toLowerCase();
  return MUSCLE_MAP.find(([k]) => n.includes(k))?.[1] || 'unlisted';
};

export const PROGRAM_RULES = `Program knowledge for building one combined session:
- Day focus: ${Object.entries(DAY_FOCUS).map(([d, f]) => `Day ${d} = ${f}`).join(' ')}
- Cover every movement pattern of the owed days (at least one lift each): squat or leg press (quads), hinge or leg curl
  (hamstrings, glutes), horizontal push (chest), vertical push (shoulders), horizontal pull (mid-back), vertical pull (lats),
  arms, and core. Do not drop a pattern that only one owed day covers.
- Prefer the owed and due days' own exercises (role "owed" or "due"). Take a lift from another day (role "library") only
  to fill a pattern nothing else covers.
- Never list one exercise twice, and never two lifts that do the same job when a different job is missing.
- Keep the main lifts (the first, heaviest lifts of each day) before the isolation work.
- Budget: 90 minutes including 10 minutes of warm-up. Each set takes about 40 seconds plus its rest. A typical combined
  session has 6 to 9 exercises at 2 to 3 sets each.
- Weights and reps come from the progression rule and are final. Do not change them.`;
