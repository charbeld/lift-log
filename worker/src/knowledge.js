// Research notes the coach reasons from. Each source has an id the model must cite.
// Confidence is stated honestly: "primary" = paper read, "secondary" = summary of a coach's public content, "heuristic" = our own rule.
export const SOURCES = [
  {
    id: 'S1',
    title: 'Plotkin et al. 2022, PeerJ: load vs repetition progression (8 weeks, 43 trained adults)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9528903/',
    confidence: 'primary',
    finding: 'Increasing load (keeping 8-12 reps) and increasing reps at a fixed load produced similar muscle growth. Load progression was slightly better for max strength. Rep progression helps when heavier weights are not available. Small, 8 weeks, quads and calves only.',
  },
  {
    id: 'S2',
    title: 'Double progression (Liftosaur program definition; common coaching method)',
    url: 'https://www.liftosaur.com/p/5c815e45',
    confidence: 'secondary',
    finding: 'Work inside a rep range: add reps each session at the same weight until every set reaches the top of the range, then add weight and drop back to the bottom of the range.',
  },
  {
    id: 'S3',
    title: 'Jeff Nippard on rep ranges (as summarized by Fitnessvolt and Generation Iron)',
    url: 'https://fitnessvolt.com/jeff-nippard-discusses-best-rep-ranges/',
    confidence: 'secondary',
    finding: 'Mix rep ranges. Lower reps suit compounds (squats, presses) and higher reps suit isolation work (leg extensions, pressdowns). Effort (sets close to failure) matters more than the exact rep number.',
  },
  {
    id: 'S4',
    title: 'Jeff Nippard progression guidance (as summarized by MaleOptimal; not verified against his own content)',
    url: 'https://www.maleoptimal.co.uk/guides/jeff-nippard-progressive-overload',
    confidence: 'secondary, low',
    finding: 'Train most sets about 2-3 reps in reserve. On main compounds, add 1-2 reps per week, or add 2.5-5 kg once the top of the rep range is reached.',
  },
  {
    id: 'S5',
    title: 'Weekly sets per muscle and hypertrophy (dose-response, as summarized by Progressive overload guide)',
    url: 'https://musclescience.org/progressive-overload-explained/',
    confidence: 'secondary',
    finding: 'Muscle growth tracks total weekly hard sets per muscle group more than any single exercise. Training a muscle twice a week can beat once a week at equal volume.',
  },
  {
    id: 'S6',
    title: 'Remmert et al. 2025, SportRxiv preprint: per-session volume meta-regressions',
    url: 'https://sportrxiv.org/index.php/server/preprint/view/537',
    confidence: 'review (preprint, not peer-reviewed)',
    finding: 'More sets per session gave more growth with diminishing returns; measurable benefit stopped near 11 fractional sets per muscle per session (an indirect set counts half). For strength it was about 2 direct sets. Not a hard cap: little data at high volumes.',
  },
  {
    id: 'S7',
    title: 'Pelland et al. 2025, Sports Medicine: weekly volume and frequency dose-response (67 studies)',
    url: 'https://link.springer.com/article/10.1007/s40279-025-02344-w',
    confidence: 'review',
    finding: 'Weekly sets per muscle drive growth with diminishing returns, steeper for strength. Counting indirect sets as half fits the data best. A missed session costs little next to the weekly total.',
  },
  {
    id: 'S8',
    title: 'Kassiano et al. 2022, JSCR: varying exercises (systematic review, 241 young men)',
    url: 'https://www.researchgate.net/publication/358212528_Does_Varying_Resistance_Exercises_Promote_Superior_Muscle_Hypertrophy_and_Strength_Gains_A_Systematic_Review',
    confidence: 'review',
    finding: 'Some systematic variation (different angles of the same muscle) helps regional growth and strength; excessive random variation may hurt. Evidence is limited.',
  },
  {
    id: 'S9',
    title: 'Zabaleta-Korta et al. 2021: squat vs leg extension regional quad growth (RCT)',
    url: 'https://www.researchgate.net/publication/351577491_The_role_of_exercise_selection_in_regional_Muscle_Hypertrophy_A_randomized_controlled_trial',
    confidence: 'primary',
    finding: 'Leg extension grew all regions of the rectus femoris; the squat grew mainly the mid vastus lateralis. A compound and an isolation lift for the same muscle complement each other.',
  },
  {
    id: 'S10',
    title: 'Nunes et al. 2021, European Journal of Sport Science: exercise order meta-analysis',
    url: 'https://onlinelibrary.wiley.com/doi/abs/10.1080/17461391.2020.1733672',
    confidence: 'review',
    finding: 'Lifts done first in a session gain more strength; order does not change muscle growth. Put the main compounds first.',
  },
  {
    id: 'S11',
    title: 'Singer et al. 2024, Frontiers: inter-set rest Bayesian meta-analysis',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/',
    confidence: 'review',
    finding: 'A small growth benefit from resting more than 60 s; no detectable gain beyond 90 s. Isolation lifts can rest 60-90 s; heavy compounds 2-3 min for strength.',
  },
  {
    id: 'S12',
    title: 'Belcher et al. 2019, APNM: recovery after squat, bench press and deadlift (12 trained men)',
    url: 'https://cdnsciencepub.com/doi/10.1139/apnm-2019-0004',
    confidence: 'primary, small',
    finding: 'Squat bar speed took up to 96 h to recover, bench press about 24 h; muscle-damage markers took 48-72 h. Avoid two heavy knee-dominant compounds in one session.',
  },
  {
    id: 'S13',
    title: 'Jeff Nippard, "Full Body 5x Per Week" (YouTube, his own words)',
    url: 'https://www.youtube.com/watch?v=eTxO5ZMxcsc',
    confidence: 'secondary',
    finding: '10-20 weekly sets per muscle; a per-workout ceiling of about 5-10 sets, beyond which sets risk being wasted. On a long leg day performance drops by the 3rd-4th leg exercise, so one lift per pattern keeps every set fresh.',
  },
  {
    id: 'S14',
    title: 'Jeff Nippard, "How To Train Like A Minimalist" (YouTube, his own words)',
    url: 'https://www.youtube.com/watch?v=xc4OtzAnVMI',
    confidence: 'secondary',
    finding: '1-4 weekly sets give about 64% and 5-9 about 84% of maximum growth, so trimming sets costs little. Do not superset lifts that train the same muscle; unrelated pairs save time. Machines need fewer warm-up sets.',
  },
  {
    id: 'S15',
    title: 'Renaissance Periodization (Dr. Mike Israetel): how many exercises per workout',
    url: 'https://rpstrength.com/blogs/videos/how-many-exercises-per-workout-dr-mikes-guide',
    confidence: 'secondary',
    finding: '1-3 exercises per muscle per session; quality fades after 5-7 sets of one movement; diminishing returns beyond 10-12 hard sets per muscle per session. Several variations of the same pattern (four rows) add little.',
  },
  {
    id: 'S16',
    title: 'Stronger by Science (Greg Nuckols): training volume guide',
    url: 'https://www.strongerbyscience.com/volume/',
    confidence: 'secondary',
    finding: 'Count weekly fractional sets (a synergist set counts half). About 11 fractional sets per session is where measurable benefit stops, depending on frequency. Low-effort accessory sets late in a session are the likeliest junk volume.',
  },
  {
    id: 'H1',
    title: 'Same exercise, different day (engineering heuristic, not from a study)',
    url: '',
    confidence: 'heuristic',
    finding: 'Judge progression only against history done in the same rep range as today\'s target. If no session matches the range, convert the best recent set to an estimated 1RM (Epley: w * (1 + r/30)) and derive a conservative weight for today\'s range.',
  },
  {
    id: 'H2',
    title: 'Combined-session volume and swaps (our rule, built on S6, S7, S13, S15)',
    url: '',
    confidence: 'heuristic',
    finding: 'In a combined session, do not add up the sets of both days. Keep each muscle at or under about 10 fractional sets (large muscles 4-8 direct, small 2-4); overlapping exercises get 2 sets. A lift from another day may replace one of the same pattern, with the sets of the lift it replaces.',
  },
];

export const SOURCE_IDS = SOURCES.map((s) => s.id);

export const KNOWLEDGE = SOURCES.map((s) => `[${s.id}] (${s.confidence}) ${s.title}. ${s.finding}${s.url ? ' ' + s.url : ''}`).join('\n');
