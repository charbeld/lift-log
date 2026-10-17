// Demo pictures for each exercise, so the lifter knows which machine or movement is meant. Each demo is two photos
// (start and end position) from free-exercise-db (public domain, Unlicense), shown alternating as a short animation.
// Pinned to one commit so the cached files never change under us.
const BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

// First match wins, so the more specific names come first. Covers the program and every swap in the swap table.
const DEMOS = [
  ['leg press (narrow', 'Narrow_Stance_Leg_Press'],
  ['leg press', 'Leg_Press'],
  ['pendulum squat', 'Hack_Squat'],
  ['hack squat', 'Hack_Squat'],
  ['smith machine squat', 'Smith_Machine_Squat'],
  ['goblet squat', 'Goblet_Squat'],
  ['sissy squat', 'Weighted_Sissy_Squat'],
  ['single-leg extension', 'Single-Leg_Leg_Extension'],
  ['leg extension', 'Leg_Extensions'],
  ['slider leg curl', null], // no matching demo; better none than the wrong machine
  ['lying leg curl', 'Lying_Leg_Curls'],
  ['standing leg curl', 'Standing_Leg_Curl'],
  ['leg curl', 'Seated_Leg_Curl'],
  ['reverse hyper', 'Reverse_Hyperextension'],
  ['pull-through', 'Pull_Through'],
  ['back extension', 'Hyperextensions_Back_Extensions'],
  ['smith incline', 'Smith_Machine_Incline_Bench_Press'],
  ['machine incline', 'Leverage_Incline_Chest_Press'],
  ['low-to-high cable fly', 'Low_Cable_Crossover'],
  ['low cable fly', 'Low_Cable_Crossover'],
  ['incline', 'Incline_Dumbbell_Press'],
  ['close-grip smith', 'Smith_Machine_Close-Grip_Bench_Press'],
  ['machine chest press (decline', 'Leverage_Decline_Chest_Press'],
  ['machine chest press', 'Leverage_Chest_Press'],
  ['db flat press', 'Dumbbell_Bench_Press'],
  ['bench press', 'Smith_Machine_Bench_Press'],
  ['cable crossover', 'Cable_Crossover'],
  ['pec deck', 'Butterfly'],
  ['chest fly', 'Butterfly'],
  ['dip', 'Dip_Machine'],
  ['straight-arm pulldown', 'Straight-Arm_Pulldown'],
  ['assisted pull-up', 'Band_Assisted_Pull-Up'],
  ['pulldown', 'Wide-Grip_Lat_Pulldown'],
  ['chest-supported db row', 'Dumbbell_Incline_Row'],
  ['t-bar row', 'Lying_T-Bar_Row'],
  ['chest-supported row', 'Leverage_Iso_Row'],
  ['machine row', 'Leverage_Iso_Row'],
  ['single-arm cable row', 'Seated_One-arm_Cable_Pulley_Rows'],
  ['cable row', 'Seated_Cable_Rows'],
  ['machine shoulder press', 'Leverage_Shoulder_Press'],
  ['smith shoulder press', 'Smith_Machine_Overhead_Shoulder_Press'],
  ['overhead press', 'Dumbbell_Shoulder_Press'],
  ['cable lateral raise', 'Cable_Seated_Lateral_Raise'],
  ['lateral raise', 'Side_Lateral_Raise'],
  ['machine shrug', 'Leverage_Shrug'],
  ['cable shrug', 'Cable_Shrugs'],
  ['shrug', 'Dumbbell_Shrug'],
  ['overhead cable extension', 'Cable_Rope_Overhead_Triceps_Extension'],
  ['skull crusher', 'EZ-Bar_Skullcrusher'],
  ['pushdown', 'Triceps_Pushdown'],
  ['preacher curl', 'Machine_Preacher_Curls'],
  ['cable curl', 'Standing_Biceps_Cable_Curl'],
  ['ez bar curl', 'EZ-Bar_Curl'],
  ['bicep curl', 'Dumbbell_Bicep_Curl'],
  ['cable crunch', 'Cable_Crunch'],
  ['machine crunch', 'Ab_Crunch_Machine'],
  ['pallof', 'Pallof_Press'],
  ['leg raise', 'Hanging_Leg_Raise'],
];

// The two frame URLs for an exercise name, or null when there is no demo for it.
export function demoFor(name) {
  const n = String(name || '').toLowerCase();
  const id = DEMOS.find(([k]) => n.includes(k))?.[1];
  return id ? [`${BASE}${id}/0.jpg`, `${BASE}${id}/1.jpg`] : null;
}

// Markup for the demo: both frames stacked, the second fading in and out over the first (see .demo in styles.css).
export function demoHtml(name, esc) {
  const d = demoFor(name);
  if (!d) return '';
  return `<div class="demo" role="img" aria-label="${esc(name)} demonstration">
    <img src="${d[0]}" alt="" loading="lazy" decoding="async"><img src="${d[1]}" alt="" loading="lazy" decoding="async"></div>`;
}
