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
    id: 'H1',
    title: 'Same exercise, different day (engineering heuristic, not from a study)',
    url: '',
    confidence: 'heuristic',
    finding: 'Judge progression only against history done in the same rep range as today\'s target. If no session matches the range, convert the best recent set to an estimated 1RM (Epley: w * (1 + r/30)) and derive a conservative weight for today\'s range.',
  },
];

export const SOURCE_IDS = SOURCES.map((s) => s.id);

export const KNOWLEDGE = SOURCES.map((s) => `[${s.id}] (${s.confidence}) ${s.title}. ${s.finding}${s.url ? ' ' + s.url : ''}`).join('\n');
