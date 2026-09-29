// Default program, transcribed from Improved_3Day_Workout_Program (Day A / B / C tabs).

export const PROGRESSION_RULE =
  'Start at the bottom of each rep range. Add 1 rep per set each week. When you hit the top of the range on ALL sets, move the pin up one notch / add 2.5 kg and reset to the bottom of the range.';

const ex = (cat, name, sets, repMin, repMax, start, rest, notes, extra = {}) => ({
  cat, name, sets, repMin, repMax, start, rest, notes, inc: 2.5, ...extra,
});
const wu = (name, detail, notes) => ({ cat: 'WARM-UP', name, detail, notes });

export const DEFAULT_PROGRAM = {
  A: {
    title: 'Day A · Push',
    subtitle: 'Chest, quads, shoulders + pulls',
    warmups: [
      wu('Dynamic Stretching', '5-7 min', 'Arm circles, leg swings, hip circles, bodyweight squats, band pull-aparts.'),
      wu('Feeder Set (Leg Press)', '1 × 10 @ 50% load', 'Warm up knees and quads with light leg press.'),
    ],
    items: [
      ex('MACHINE', 'Leg Press', 4, 8, 10, '60-80 kg', 150, "Feet shoulder-width; don't lock knees at top. Main quad/glute builder. Go heavy here."),
      ex('MACHINE', 'Bench Press (Smith or DB)', 4, 8, 10, '30-35 kg / 12-14 kg DB', 150, '2s lowering phase; retract shoulder blades. If Smith, set safety stops. Primary chest builder.'),
      ex('MACHINE', 'Lat Pulldown', 3, 10, 12, '30-35 kg', 90, 'Pull to upper chest; lean back slightly; squeeze lats hard at bottom. Balances your pressing.'),
      ex('MACHINE', 'Leg Extension', 3, 12, 15, '20-25 kg', 60, 'Pause 1s at top for full quad contraction. Great isolation finisher after leg press.'),
      ex('MACHINE', 'Overhead Press (DB or Machine)', 3, 10, 12, '8-10 kg DB', 90, 'Keep forearms vertical; brace core tight. Builds shoulder width.', { inc: 2 }),
      ex('MACHINE', 'Seated Cable Row (Close Grip)', 3, 10, 12, '30-35 kg', 60, 'Pull to belly; squeeze shoulder blades 1s. Keeps push:pull balanced.'),
      ex('FREE', 'Bicep Curls (DB)', 2, 12, 15, '6-8 kg', 45, 'Elbows glued to sides; no momentum. Slow eccentric.', { inc: 1 }),
      ex('CORE', 'Cable Crunch', 3, 12, 15, '20-25 kg', 45, "Curl ribs toward hips; don't just bow. Squeeze at the bottom."),
    ],
  },
  B: {
    title: 'Day B · Pull',
    subtitle: 'Back, hamstrings, glutes + pushes',
    warmups: [
      wu('Dynamic Stretching', '5-7 min', 'Leg swings, arm circles, band dislocates, bodyweight lunges, cat-cow.'),
      wu('Feeder Set (Back Extension)', '1 × 10 @ bodyweight', 'Warm up posterior chain before heavy work.'),
    ],
    items: [
      ex('MACHINE', 'Hack Squat', 4, 8, 10, 'Empty / 10 kg per side', 150, 'Go deep for full glute/quad activation. A machine squat, great for safe progressive overload.'),
      ex('MACHINE', 'Chest-Supported Row (Machine)', 4, 10, 12, '20-30 kg', 120, 'Chest against pad; drive elbows straight back. Best machine for back thickness, no cheating possible.'),
      ex('MACHINE', 'Seated Leg Curl', 3, 10, 12, '20-30 kg', 60, 'Keep hips down; squeeze hard at the bottom. Targets hamstrings directly.'),
      ex('MACHINE', 'Incline DB Press (30°)', 3, 10, 12, '12-14 kg', 90, "Builds upper chest 'shelf'. Control the 2-3s eccentric.", { inc: 2 }),
      ex('MACHINE', 'Lat Pulldown (Wide Grip)', 3, 10, 12, '30-35 kg', 90, 'Wide grip variation for lat width. Pull to collarbone.'),
      ex('MACHINE', 'Back Extension (Weighted)', 3, 12, 15, 'Hold 5-10 kg plate', 60, 'Tuck chin; squeeze glutes at top. This IS your hip hinge. Progress by holding heavier plates.'),
      ex('FREE', 'Lateral Raises (DB)', 3, 15, 20, '4-6 kg', 45, 'Lead with elbows; slight forward lean. Light weight, high reps for capped delts.', { inc: 1 }),
      ex('CORE', 'Hanging Knee/Leg Raises', 3, 10, 15, 'Bodyweight', 60, 'Control the swing; curl pelvis up. Progress to straight-leg over time.', { inc: 0 }),
    ],
  },
  C: {
    title: 'Day C · Mix',
    subtitle: 'Different angles, weak points, pump work',
    warmups: [
      wu('Dynamic Stretching', '5-7 min', "World's greatest stretch, band pull-aparts, goblet squat hold, hip circles."),
      wu('Feeder Set (Leg Press)', '1 × 8 @ 50% load', 'Light set to warm up.'),
    ],
    items: [
      ex('MACHINE', 'Leg Press (Narrow/High Feet)', 3, 12, 15, '60-80 kg', 120, 'High foot placement shifts emphasis to glutes & hamstrings. Different stimulus from Day A.'),
      ex('MACHINE', 'Dips Machine (Assisted)', 3, 10, 12, 'Assist / BW', 90, 'Lean forward for chest; stay upright for triceps. Great compound upper push.'),
      ex('MACHINE', 'Seated Cable Row (Wide Grip)', 3, 10, 12, '30-35 kg', 90, "Wide grip targets rear delts + mid-back. Different from Day A's close grip."),
      ex('MACHINE', 'Leg Extension', 3, 15, 20, '15-20 kg', 45, 'Higher reps, lighter weight. Focus on the squeeze. Quad pump finisher.'),
      ex('MACHINE', 'Machine Chest Fly', 3, 12, 15, '15-25 kg', 60, 'Slight elbow bend; squeeze hard at peak contraction. Chest isolation after dips.'),
      ex('MACHINE', 'Leg Curl (Lying or Seated)', 3, 12, 15, '20-25 kg', 60, 'Squeeze at full contraction. Hamstring isolation to complement leg press.'),
      ex('MACHINE', 'DB Shrugs', 3, 12, 15, '12-16 kg', 45, "Hold 1s at top; don't roll shoulders. Upper trap builder.", { inc: 2 }),
      ex('FREE', 'Tricep Pushdowns (Cable)', 2, 12, 15, '15-20 kg', 45, 'Only forearms move; chest up, elbows locked.'),
      ex('CORE', 'Machine Crunch or Pallof Press', 3, 12, 15, 'Light-moderate', 45, 'If machine crunch: curl ribs to hips. If Pallof: anti-rotation, 10/side.'),
    ],
  },
};

// From the "Exercise Swaps" tab. Keys are matched loosely against exercise names.
export const SWAPS = [
  ['Leg Press', ['Hack Squat', 'Smith Machine Squat', 'Pendulum Squat']],
  ['Hack Squat', ['Leg Press (narrow stance)', 'Smith Machine Squat', 'Goblet Squat (DB)']],
  ['Bench Press', ['Machine Chest Press', 'DB Flat Press', 'Smith Incline Press']],
  ['Incline DB Press', ['Smith Incline Press', 'Machine Incline Press', 'Low-to-High Cable Fly']],
  ['Lat Pulldown', ['Machine Pulldown', 'Assisted Pull-up Machine', 'Straight-Arm Pulldown']],
  ['Seated Cable Row', ['Machine Row', 'Chest-Supported DB Row', 'Single-Arm Cable Row']],
  ['Chest-Supported Row', ['T-Bar Row Machine', 'Seated Cable Row (neutral)', 'Machine Row']],
  ['Chest Fly', ['Cable Crossover', 'Pec Deck', 'Low Cable Fly']],
  ['Leg Extension', ['Sissy Squat Machine', 'Single-Leg Extension', 'Wall Sit (isometric)']],
  ['Leg Curl', ['Lying Leg Curl', 'Standing Leg Curl', 'Slider Leg Curl (BW)']],
  ['Overhead Press', ['Machine Shoulder Press', 'Smith Shoulder Press', 'Landmine Press']],
  ['Dips', ['Machine Chest Press (decline)', 'Close-Grip Smith Bench', 'Cable Dip']],
  ['Back Extension', ['Reverse Hyper', '45° Back Extension', 'Cable Pull-Through']],
  ['Shrugs', ['Machine Shrugs', 'Smith Machine Shrugs', 'Cable Shrugs']],
  ['Bicep Curls', ['Cable Curls', 'Machine Preacher Curl', 'EZ Bar Curls']],
  ['Tricep Pushdowns', ['Overhead Cable Extension', 'Machine Dip', 'Skull Crushers (EZ Bar)']],
];

export function swapOptions(name) {
  const n = name.toLowerCase();
  const hit = SWAPS.find(([k]) => n.includes(k.toLowerCase()));
  return hit ? hit[1] : [];
}

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const exId = (day, name) => `${day}:${slug(name)}`;

export function freshProgram() {
  const p = structuredClone(DEFAULT_PROGRAM);
  for (const day of Object.keys(p)) for (const it of p[day].items) it.id = exId(day, it.name);
  return p;
}
