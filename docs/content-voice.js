/* =========================================================================
   content-voice.js — the VOICE half of the gym: articulation + vocabulary.

   Everything here is content, no logic. Edit freely; the modules read it.
   ========================================================================= */

/* -------------------------------------------------------------------------
   ARTICULATION
   Structure follows the standard vocal-warmup order: loosen the articulators,
   drill the consonants, then run precision work under load. The load exercises
   (pencil, over-articulation) work on the same principle as a weighted bat —
   you make the task harder, then normal speech feels effortless by contrast.
   ------------------------------------------------------------------------- */

const WARMUP = [
  {
    id: 'lip-trill',
    name: 'Lip trill',
    seconds: 30,
    cue: 'Blow air through loose lips — a motorboat "brrrr". Add a pitch glide up and down.',
    why: 'Loosens the lips and warms the vocal folds at once. If the trill will not start, your lips are too tense — hum through them instead.',
  },
  {
    id: 'jaw',
    name: 'Jaw release',
    seconds: 30,
    cue: 'Open gently, stretch side to side, then big exaggerated chewing motions.',
    why: 'A tight jaw physically caps how far your mouth opens, which caps both articulation and projection. This is the step people skip and then wonder why nothing improved.',
  },
  {
    id: 'tongue',
    name: 'Tongue stretch',
    seconds: 25,
    cue: 'Tongue out and down, hold. Then sweep it around the inside of your lips, both directions.',
    why: 'The tongue is the fastest articulator you own and the one doing most of the work in consonants.',
  },
];

const CONSONANT_DRILLS = [
  {
    id: 'ptk',
    name: 'P–T–K',
    reps: 12,
    cue: 'Puh · Tuh · Kuh — crisp and separated.',
    why: 'Front of mouth, middle, back. Hits all three points of articulation in one drill.',
  },
  {
    id: 'bdg',
    name: 'B–D–G',
    reps: 12,
    cue: 'Buh · Duh · Guh — the voiced twins of P/T/K.',
    why: 'Same three positions with the voice switched on, so the folds engage with the consonant.',
  },
  {
    id: 'ptk-fast',
    name: 'P–T–K at speed',
    reps: 20,
    cue: 'Same sounds, twice the pace — but abort the moment they smear.',
    why: 'Speed is only worth training while precision holds. Sloppy fast reps train sloppiness.',
  },
];

/* Tongue twisters, graded. `focus` names the sound being trained so a weak
   consonant can be targeted rather than shotgunned. */
const TWISTERS = [
  { level: 1, focus: 'f / d', text: 'Fred fed Ted bread, and Ted fed Fred bread.' },
  { level: 1, focus: 'k / ch', text: 'I saw a kitten eating chicken in the kitchen.' },
  { level: 1, focus: 'r / l', text: 'Red lorry, yellow lorry, red lorry, yellow lorry.' },
  { level: 1, focus: 'p', text: 'Peter Piper picked a peck of pickled peppers.' },
  { level: 2, focus: 's / sh', text: 'She sells seashells by the seashore, and the shells she sells are surely seashells.' },
  { level: 2, focus: 'w / v', text: 'Which witch switched the Swiss wristwatches?' },
  { level: 2, focus: 'th', text: 'Thirty-three thirsty thinkers thought a thoroughly thrilling thought.' },
  { level: 2, focus: 'b / t', text: 'Betty bought a bit of butter, but the butter Betty bought was bitter.' },
  { level: 3, focus: 'sixth / s-cluster', text: 'The sixth sick sheikh\'s sixth sheep\'s sick.' },
  { level: 3, focus: 'p / b plosives', text: 'Pad kid poured curd pulled cod.' },
  { level: 3, focus: 'consonant clusters', text: 'Brisk brave brigadiers brandished broad bright blades, blunderbusses, and bludgeons.' },
  { level: 3, focus: 'n / m nasals', text: 'A knapsack strap snapped and Nan\'s nap snapped shut.' },
];

/* Sustained passages — the real test. A twister is one hard second; a paragraph
   is sixty, which is where jaw fatigue and lazy endings actually show up. */
const PASSAGES = [
  {
    id: 'rainbow',
    name: 'The Rainbow Passage (opening)',
    note: 'The standard clinical passage for speech assessment — it contains nearly every sound in English.',
    text: 'When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow. The rainbow is a division of white light into many beautiful colours. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon.',
  },
  {
    id: 'clusters',
    name: 'Cluster gauntlet',
    note: 'Written to stack consonant clusters. Slow first. Every ending consonant must survive.',
    text: 'The strengths of the twelfth-month drafts astonished the sixth-form students, whose texts glimpsed depths that crisp scripts and blunt facts had asked for but scarcely grasped.',
  },
  {
    id: 'endings',
    name: 'Word-ending discipline',
    note: 'Dropped final consonants are the single most common clarity leak in casual speech.',
    text: 'He wanted the facts, expected the reports, respected the attempts, and accepted the results — but the drafts he collected lacked the depths the project demanded, and the effects lasted.',
  },
  {
    id: 'vowels',
    name: 'Vowel shaping',
    note: 'Stretch every vowel to its full length. Vowels carry the tone; consonants carry the meaning.',
    text: 'The old road wound below the deep blue lake, where slow boats rowed toward the far shore, and the pale moon rose above the tall pines in the cool evening air.',
  },
];

const LOAD_DRILLS = [
  {
    id: 'pencil',
    name: 'The pencil trick',
    cue: 'Hold a pencil horizontally between your teeth. Read a passage aloud. Remove it and read again.',
    why: 'Forces the lips and tongue to overwork around an obstruction. Removing it leaves the articulators over-powered for the task — the same reason a weighted bat makes the real one feel light.',
    safety: 'Light bite, no clamping. Stop if the jaw aches.',
  },
  {
    id: 'back-row',
    name: 'Back row projection',
    cue: 'Read as if for the back row of a theatre. Hit every vowel and consonant enormously. Then say it normally.',
    why: 'Recalibrates what "clear" feels like. Your normal setting drifts quieter and lazier than you think; this resets the reference point.',
  },
  {
    id: 'over-artic',
    name: 'Over-articulation pass',
    cue: 'Same sentence three times: hugely exaggerated, then medium, then normal conversational.',
    why: 'The descent is the exercise. You keep most of the precision while dropping the effort.',
  },
];

/* -------------------------------------------------------------------------
   VOCABULARY

   Two separate things, because they solve different problems:

   UPGRADES fix dilution — "very big" is two words doing one word's job, and
   the intensifier ("very", "really", "so") signals that the speaker reached
   for emphasis instead of precision. One exact word outperforms a modifier
   stack every time.

   WORDS build range. Chosen for actual conversational usefulness, not for
   sounding clever — a word you would plausibly say out loud this week.
   Sounding like a thesaurus is worse than sounding plain.
   ------------------------------------------------------------------------- */

const UPGRADES = [
  { weak: 'very big',        strong: ['huge', 'vast', 'colossal', 'towering'] },
  { weak: 'very small',      strong: ['tiny', 'minute', 'cramped', 'negligible'] },
  { weak: 'very good',       strong: ['superb', 'excellent', 'first-rate', 'stellar'] },
  { weak: 'very bad',        strong: ['dire', 'abysmal', 'wretched', 'dismal'] },
  { weak: 'very tired',      strong: ['exhausted', 'drained', 'spent', 'wiped out'] },
  { weak: 'very hungry',     strong: ['ravenous', 'starving', 'famished'] },
  { weak: 'very angry',      strong: ['furious', 'livid', 'incensed', 'seething'] },
  { weak: 'very happy',      strong: ['elated', 'delighted', 'thrilled', 'over the moon'] },
  { weak: 'very sad',        strong: ['devastated', 'crushed', 'heartbroken', 'bleak'] },
  { weak: 'very scared',     strong: ['terrified', 'petrified', 'spooked'] },
  { weak: 'very interested', strong: ['fascinated', 'gripped', 'hooked', 'rapt'] },
  { weak: 'very boring',     strong: ['tedious', 'dreary', 'deadening', 'interminable'] },
  { weak: 'very funny',      strong: ['hilarious', 'uproarious', 'absurd'] },
  { weak: 'very tasty',      strong: ['delicious', 'moreish', 'sublime'] },
  { weak: 'very old',        strong: ['ancient', 'antique', 'weathered', 'venerable'] },
  { weak: 'very clean',      strong: ['spotless', 'immaculate', 'pristine'] },
  { weak: 'very dirty',      strong: ['filthy', 'grimy', 'squalid'] },
  { weak: 'very smart',      strong: ['sharp', 'brilliant', 'incisive', 'formidable'] },
  { weak: 'very confusing',  strong: ['baffling', 'opaque', 'impenetrable'] },
  { weak: 'very important',  strong: ['crucial', 'pivotal', 'load-bearing', 'decisive'] },
  { weak: 'very busy',       strong: ['swamped', 'slammed', 'stretched', 'flat out'] },
  { weak: 'very expensive',  strong: ['steep', 'extortionate', 'eye-watering'] },
  { weak: 'very quiet',      strong: ['hushed', 'still', 'muted'] },
  { weak: 'very loud',       strong: ['deafening', 'thunderous', 'blaring'] },
  { weak: 'very pretty',     strong: ['striking', 'lovely', 'radiant'] },
  { weak: 'very strange',    strong: ['bizarre', 'uncanny', 'surreal', 'peculiar'] },
  { weak: 'very difficult',  strong: ['brutal', 'punishing', 'gruelling'] },
  { weak: 'very easy',       strong: ['effortless', 'trivial', 'a doddle'] },
  { weak: 'very sure',       strong: ['certain', 'convinced', 'adamant'] },
  { weak: 'very hot',        strong: ['sweltering', 'blistering', 'searing'] },
  { weak: 'very cold',       strong: ['freezing', 'bitter', 'biting'] },
  { weak: 'very slow',       strong: ['sluggish', 'glacial', 'plodding'] },
  { weak: 'very fast',       strong: ['rapid', 'blistering', 'headlong'] },
  { weak: 'a lot of',        strong: ['plenty of', 'no shortage of', 'a mountain of'] },
  { weak: 'kind of / sort of', strong: ['— cut it entirely —'] },
  { weak: 'I think maybe',   strong: ['— say the thing —'] },
];

const WORDS = [
  { word: 'candid',       pos: 'adj', meaning: 'honest in a way that might be uncomfortable', example: 'Can I be candid? I think you buried the interesting part.' },
  { word: 'gracious',     pos: 'adj', meaning: 'kind and courteous, especially when you did not have to be', example: 'That was a gracious way to lose an argument.' },
  { word: 'restless',     pos: 'adj', meaning: 'unable to settle, itching for change', example: 'I have been restless since the course ended.' },
  { word: 'measured',     pos: 'adj', meaning: 'careful and unhurried, deliberately controlled', example: 'He gave a measured answer, which told me he had thought about it before.' },
  { word: 'earnest',      pos: 'adj', meaning: 'sincere and serious, without irony', example: 'She is earnest about it in a way most people are embarrassed to be.' },
  { word: 'disarming',    pos: 'adj', meaning: 'so warm or frank that it removes hostility', example: 'He has a disarming habit of admitting the worst thing first.' },
  { word: 'relentless',   pos: 'adj', meaning: 'never letting up', example: 'The schedule is relentless but I would not swap it.' },
  { word: 'understated',  pos: 'adj', meaning: 'deliberately low-key, effective without announcing itself', example: 'Understated confidence beats the loud kind every time.' },
  { word: 'compelling',   pos: 'adj', meaning: 'holds your attention against your will', example: 'It is a compelling argument even though I do not want it to be.' },
  { word: 'tedious',      pos: 'adj', meaning: 'boring through length and repetition', example: 'The admin is tedious; the work itself is not.' },
  { word: 'wary',         pos: 'adj', meaning: 'cautious because something feels off', example: 'I am wary of advice that has a course attached to it.' },
  { word: 'blunt',        pos: 'adj', meaning: 'direct to the point of roughness', example: 'To be blunt, the second half does not work.' },
  { word: 'nuance',       pos: 'noun', meaning: 'a small distinction that changes the meaning', example: 'You lost the nuance when you summarised it.' },
  { word: 'threshold',    pos: 'noun', meaning: 'the point where something changes state', example: 'There is a threshold where practice becomes instinct.' },
  { word: 'leverage',     pos: 'noun', meaning: 'the thing that gives you disproportionate effect', example: 'Reading is not the leverage. Doing is.' },
  { word: 'friction',     pos: 'noun', meaning: 'resistance that slows something down', example: 'Every extra step is friction, and friction is why people quit.' },
  { word: 'candour',      pos: 'noun', meaning: 'the quality of being open and honest', example: 'I would trade agreement for candour any day.' },
  { word: 'conviction',   pos: 'noun', meaning: 'a firmly held belief, or the force of holding it', example: 'He said it with enough conviction that the room went quiet.' },
  { word: 'appetite',     pos: 'noun', meaning: 'willingness or hunger for something', example: 'There is no appetite in the team for another rewrite.' },
  { word: 'premise',      pos: 'noun', meaning: 'the assumption an argument stands on', example: 'I disagree with the premise, not the conclusion.' },
  { word: 'hedge',        pos: 'verb', meaning: 'to avoid committing to a position', example: 'Stop hedging and tell me what you actually think.' },
  { word: 'concede',      pos: 'verb', meaning: 'to admit a point is right', example: 'I will concede that — you were right about the timing.' },
  { word: 'gravitate',    pos: 'verb', meaning: 'to be drawn towards something', example: 'People gravitate to whoever seems least worried.' },
  { word: 'linger',       pos: 'verb', meaning: 'to stay longer than necessary', example: 'The goodbye lingered, which told me more than the conversation had.' },
  { word: 'unpack',       pos: 'verb', meaning: 'to break something down into its parts', example: 'Can we unpack that? I do not think we mean the same thing.' },
  { word: 'defer',        pos: 'verb', meaning: 'to yield to someone else\'s judgement, or postpone', example: 'I will defer to you on this — it is your field.' },
  { word: 'undercut',     pos: 'verb', meaning: 'to weaken something, often your own point', example: 'You undercut yourself when you apologise before speaking.' },
  { word: 'reframe',      pos: 'verb', meaning: 'to present the same facts under a different meaning', example: 'Reframe it as an experiment and the fear drops by half.' },
  { word: 'pare back',    pos: 'verb', meaning: 'to trim to the essentials', example: 'Pare it back until only the load-bearing parts are left.' },
  { word: 'sit with',     pos: 'verb', meaning: 'to tolerate a feeling without acting on it', example: 'I am trying to sit with the discomfort instead of filling it.' },
];

window.VOICE_CONTENT = {
  WARMUP, CONSONANT_DRILLS, TWISTERS, PASSAGES, LOAD_DRILLS, UPGRADES, WORDS,
};
