// Knowledge base for building a combined session from the lifter's own exercise library. The library itself
// (names, sets, rep ranges, rest, cues) comes from the lifter's synced program; this file adds what the program
// does not say: what each day is for, which muscles each lift works, and the rules for putting two days together.

export const DAY_FOCUS = {
  A: 'Push: chest, quads, shoulders, plus pulling (lats, mid-back). Main lifts: leg press, bench press.',
  B: 'Pull: back, hamstrings, glutes, plus pushing. Main lifts: hack squat, chest-supported row.',
  C: 'Mix: different angles and weak points, pump work. Main lifts: leg press (narrow), dips, cable row (wide).',
};

// Muscles and movement pattern per lift. First match wins, so the more specific names come first.
// Lifts with the same pattern do the same job: a combined session keeps one of them.
const LIFT_MAP = [
  ['leg press (narrow', 'glutes, hamstrings, quads', 'squat'],
  ['hack squat', 'quads, glutes', 'squat'],
  ['leg press', 'quads, glutes', 'squat'],
  ['squat', 'quads, glutes', 'squat'],
  ['leg extension', 'quads', 'knee extension'],
  ['leg curl', 'hamstrings', 'knee flexion'],
  ['back extension', 'lower back, glutes, hamstrings', 'hinge'],
  ['reverse hyper', 'glutes, hamstrings, lower back', 'hinge'],
  ['pull-through', 'glutes, hamstrings', 'hinge'],
  ['incline', 'upper chest, front delts', 'incline press'],
  ['bench press', 'chest, triceps, front delts', 'horizontal press'],
  ['chest press', 'chest, triceps, front delts', 'horizontal press'],
  ['chest fly', 'chest', 'chest fly'],
  ['dips', 'chest, triceps', 'dip'],
  ['pulldown', 'lats, biceps', 'vertical pull'],
  ['pull-up', 'lats, biceps', 'vertical pull'],
  ['row', 'mid-back, lats, rear delts', 'horizontal pull'],
  ['overhead press', 'shoulders, triceps', 'vertical press'],
  ['shoulder press', 'shoulders, triceps', 'vertical press'],
  ['lateral raise', 'side delts', 'lateral raise'],
  ['shrug', 'upper traps', 'shrug'],
  ['pushdown', 'triceps', 'triceps isolation'],
  ['bicep curl', 'biceps', 'biceps isolation'],
  ['crunch', 'abs', 'core'],
  ['pallof', 'abs, obliques', 'core'],
  ['leg raise', 'abs, hip flexors', 'core'],
];

const lift = (name) => {
  const n = String(name).toLowerCase();
  return LIFT_MAP.find(([k]) => n.includes(k));
};
export const musclesFor = (name) => lift(name)?.[1] || 'unlisted';
export const patternFor = (name) => lift(name)?.[2] || 'unlisted';

export const PROGRAM_RULES = `Program knowledge for building one combined session:
- Day focus: ${Object.entries(DAY_FOCUS).map(([d, f]) => `Day ${d} = ${f}`).join(' ')}
- Cover every movement pattern of the owed and due days (at least one lift each): squat (quads), hinge or knee flexion
  (hamstrings, glutes), a chest press, a pull of each kind the days have (horizontal, vertical), shoulders, arms, and
  core. Do not drop a pattern that only one of the days covers.
- One lift per pattern: never two lifts with the same "pattern" (for example hack squat and leg press, or two rows).
  A compound and an isolation lift for the same muscle are fine together (leg press + leg extension) [S9, S15].
- Prefer the owed and due days' own exercises (role "owed" or "due"). Do not add up both days' sets.
- Swaps from the library: when the owed and due days have two lifts with the same pattern, keep one and drop the
  other; a lift from another day (role "library") may replace an owed or due lift of the same pattern, or fill a
  pattern nothing else covers (for example an overhead press when neither day has a vertical press). Give a swapped-in
  lift the sets of the lift it replaces, and adjust its partner: if a chest press is replaced by a fly, keep 3 sets of
  the other chest compound (dips or press); if a glute-biased leg press replaces the hack squat, give leg extension 3
  sets. State the swap in the rationale.
- Sets per muscle in the session (an indirect set counts half): chest, back, quads 4-8 direct sets; hamstrings,
  glutes, side and rear delts 3-6; biceps, triceps, abs 2-4. Stay at or under about 10 per muscle [S6, S7, S15, H2].
- When a muscle is trained by both days, its overlapping exercises get 2 sets each; main lifts keep 3 sets [H2].
- At most 2 exercises per muscle in the session, with different angles or functions [S15].
- Order: main compounds first (squat pattern, then the main row and press), then other compounds, then isolation,
  then core. Never an isolation lift before the compound for the same muscle [S10].
- Budget: 90 minutes including 10 minutes of warm-up. Each set takes about 40 seconds plus its rest. A typical combined
  session has 8 to 10 exercises at 2 to 3 sets each.
- Weights and reps come from the progression rule and are final. Do not change them.`;
