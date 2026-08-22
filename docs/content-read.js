/* =========================================================================
   content-read.js — the READING half: mechanisms, body language, warmth &
   standards (hot/cold), and identity.

   Editorial rule for this file: every claim carries a confidence tier, and
   anything popular-but-false is named as false rather than quietly omitted.
   A charisma app that repeats folk psychology makes you worse at reading
   people, because it hands you confident wrong answers.

   Tiers:  solid   — replicated, robust
           mixed   — real effect, smaller or narrower than usually claimed
           weak    — plausible, thin evidence, treat as a hunch
           myth    — popular and false
   ========================================================================= */

/* -------------------------------------------------------------------------
   MECHANISMS — the spine. Everything else in the app is an application of
   one of these. Learn these and the tactics become derivable.
   ------------------------------------------------------------------------- */

const MECHANISMS = [
  {
    id: 'escalation',
    name: 'The staircase',
    tier: 'solid',
    source: 'Aron et al. 1997, "The Experimental Generation of Interpersonal Closeness"; Altman & Taylor 1973, social penetration theory',
    claim: 'Closeness is produced by sustained, escalating, reciprocal, personal self-disclosure — not by time spent together.',
    detail:
      'Aron paired strangers for 45 minutes. One group worked through 36 questions that escalate in personal risk; the control group made small talk for the same 45 minutes. The escalation group reported feeling closer to a stranger than to the average relationship already in their life. The questions were never magic — the ordering was. Each one asks you to risk slightly more than the last.',
    misread:
      'The internet turned this into "36 questions make people fall in love". The paper is titled closeness, not love. Swap half the questions and it still works. Print the list on a card deck and you have missed the entire finding.',
    apply: 'Four floors: facts → opinions → experiences → honest things. Climb one at a time, both people, hours not minutes.',
  },
  {
    id: 'reciprocity',
    name: 'The ratchet',
    tier: 'solid',
    source: 'Reciprocity of self-disclosure — one of the most reliably replicated findings in social psychology',
    claim: 'Disclosure must be matched or the conversation snaps back to the shallowest level and stays there.',
    detail:
      'When someone offers a floor-three thing and receives a floor-one thing back, they learn the bet does not pay with you. The ceiling drops and rarely recovers. When it is matched, each exchange raises the safe ceiling for the next — your honesty licenses theirs, theirs licenses your next.',
    misread:
      'This is why interrogation fails. Question, answer, question, answer makes you a podcast host, and people can feel the microphone. The pattern is question, answer, MATCH.',
    apply: 'After they answer at a depth, volunteer your own at that depth before asking anything else.',
  },
  {
    id: 'responsiveness',
    name: 'Being seen',
    tier: 'solid',
    source: 'Harry Reis, perceived partner responsiveness',
    claim: 'The strongest single driver of felt connection is the belief that the other person understands, values, and cares about you.',
    detail:
      'Remembering a small detail and returning to it days later reads as evidence of that. It is not manners — it demonstrates that their words were encoded as important rather than merely processed.',
    apply: 'Keep one detail from every conversation. Bring it back next time, unprompted.',
  },
  {
    id: 'bids',
    name: 'Bids for connection',
    tier: 'solid',
    source: 'John Gottman',
    claim: 'Most of what people say is not information. It is a request to be met.',
    detail:
      '"Look at the sunset" is not about the sunset. It means share this moment with me. Layer one is the sentence; layer two is the emotion, need, or request underneath. Missing bids does not break anything dramatically — it just means nothing ever builds.',
    apply: 'Hear the sentence → sense what they would have to be feeling for it to make sense → check it out loud: "seems like… is that right?"',
  },
  {
    id: 'self-expansion',
    name: 'Self-expansion',
    tier: 'solid',
    source: 'Arthur Aron, self-expansion model',
    claim: 'We are drawn to people around whom our own sense of self grows.',
    detail:
      'Being around the right person makes you funnier, more articulate, more like the version of yourself you like. This is a large part of what "chemistry" actually refers to, and it explains why charisma is not a performance you emit — it is an effect other people have in your presence.',
    apply: 'Stop optimising to be impressive. Optimise for the other person leaving the conversation feeling more like themselves.',
  },
  {
    id: 'synchrony',
    name: 'Behavioural synchrony',
    tier: 'mixed',
    source: 'Nonverbal coordination / interactional synchrony literature',
    claim: 'People who feel rapport spontaneously align posture, gesture, and speech rhythm.',
    detail:
      'The alignment is real and it is a genuine readout of rapport. What is oversold is the reverse: deliberately mirroring someone to manufacture rapport is easy to overdo and reads as strange or unsettling when noticed.',
    apply: 'Read it, do not perform it. Use it as a gauge of whether rapport exists, not as a lever to create it.',
  },
  {
    id: 'warm-audience',
    name: 'The audience effect',
    tier: 'mixed',
    source: 'Laughter in conversation is largely social rather than humour-driven (Provine and successors)',
    claim: 'Most conversational laughter is not a response to jokes. It signals warmth, and being a warm audience makes people want to talk to you.',
    detail:
      'A generous listener produces better conversation from the other person than a clever talker does. Half of charisma is on the receiving side, which is the half nobody trains.',
    apply: 'Be the audience you want. Laugh easily, react visibly, let them land.',
  },
  {
    id: 'volume',
    name: 'Roll the dice more',
    tier: 'solid',
    source: 'Base rates',
    claim: 'Conversational chemistry is substantially luck — right person, right mood, right moment. The only reliable control is the number of attempts.',
    detail:
      'Any one interaction can go nowhere for reasons that have nothing to do with you. Someone had somewhere to be. Treating each attempt as a verdict on your worth is both painful and statistically illiterate.',
    apply: 'Optimise attempts, not outcomes. Judge a week, never a conversation.',
  },
];

/* -------------------------------------------------------------------------
   BODY LANGUAGE

   The governing principle, which matters more than any individual cue:
   a single cue means close to nothing. Cues are only readable as CLUSTERS,
   measured against THAT PERSON'S BASELINE, and even then they are
   probabilistic. Anyone selling you a one-to-one gesture dictionary is
   selling confident wrong answers.
   ------------------------------------------------------------------------- */

const BODY_PRINCIPLES = [
  {
    name: 'Baseline first',
    text: 'Watch how someone sits, gestures, and looks when nothing is at stake. Every reading afterwards is a deviation from that baseline, not from a textbook. Crossed arms mean nothing if they always sit like that, and they may just be cold.',
  },
  {
    name: 'Clusters, not signals',
    text: 'One long look is noise. Look plus lean plus orientation plus a lingering goodbye is signal. Demand three or four independent cues pointing the same way before you believe anything.',
  },
  {
    name: 'Both directions',
    text: 'The question is never "is this cue present" but "is it mutual". Politeness and ordinary social skill can produce almost every warm cue in isolation. What they cannot produce is a self-sustaining two-way pattern neither person is steering.',
  },
  {
    name: 'The body points where attention goes',
    text: 'Torso, feet, and shoulders orient toward what the brain is interested in, largely below conscious control. This is the most reliable class of cue you get, and it is most honest in groups, where people cannot manage it.',
  },
];

const BODY_CUES = [
  { cue: 'Torso and feet oriented toward you in a group', tier: 'mixed', read: 'Attention is on you even when the conversation is not.', caveat: 'Chairs, tables, and room layout force orientation constantly. Only count it when they had a real choice.' },
  { cue: 'Proximity-seeking — repeatedly ending up near you', tier: 'mixed', read: 'Interest, when it is bidirectional and neither of you engineered it.', caveat: 'Track who closes the gap. If it is always you, you are reading your own behaviour back at yourself.' },
  { cue: 'Spontaneous mirroring of posture and rhythm', tier: 'mixed', read: 'Rapport is present.', caveat: 'Genuine version is seamless and unnoticed. If you can see it clearly, consider that they may be doing it on purpose.' },
  { cue: 'Eye contact with a rhythm — hold, break, return', tier: 'weak', read: 'Mutual comfort. The return is the informative part, not the duration.', caveat: 'Sustained unbroken staring reads as intensity or threat, not warmth. Cultural norms vary enormously here.' },
  { cue: 'Genuine smile reaching the eyes (orbicularis oculi)', tier: 'solid', read: 'Real positive affect rather than social display.', caveat: 'The muscle distinction is real, but plenty of people can produce it voluntarily, and its absence does not prove insincerity.' },
  { cue: 'Comfortable silence, nobody scrambling to fill it', tier: 'weak', read: 'Low threat between you. Nervous systems not bracing.', caveat: 'Also just personality. Some people are comfortable in silence with everyone.' },
  { cue: 'Warm teasing flowing both ways', tier: 'weak', read: 'Comfort plus investment — you do not bother teasing someone you are indifferent to.', caveat: 'Teasing is also how some people handle discomfort. Watch whether it lands warm or sharp.' },
  { cue: 'Unprompted follow-up contact with no pretext', tier: 'mixed', read: 'You stayed in their head. Hard to manufacture.', caveat: 'Must be reciprocal to mean anything. Always-you-first is one person pursuing.' },
  { cue: 'Casual future references that include you', tier: 'weak', read: 'They are already placing you in their forward picture.', caveat: 'Some people say "we should do that" reflexively to everyone. Check whether plans ever materialise.' },
  { cue: 'Lingering goodbye', tier: 'weak', read: 'Reluctance to end the interaction.', caveat: 'One of the most over-read cues. Politeness produces long goodbyes constantly.' },
  { cue: 'Pupil dilation', tier: 'mixed', read: 'Arousal or interest — sometimes.', caveat: 'Pupils respond to light and cognitive load far more strongly than to attraction. In a dim bar everyone\'s pupils are wide. Nearly useless in the field.' },
];

const BODY_YOURS = [
  { name: 'Where to look', text: 'Default to the upper triangle — eyes and the bridge of the nose. Dropping to the mouth and neck reads as romantic interest, which is exactly wrong in a professional room and exactly right on a date. Know which one you are in.' },
  { name: 'If eye contact is hard', text: 'Look at the bridge of the nose. Indistinguishable from eye contact at conversational distance, and far easier to hold. Use it as scaffolding while you build tolerance, not as a permanent substitute.' },
  { name: 'Delay the smile', text: 'Meet their eyes, hold half a beat, then smile. A smile that arrives after the eye contact reads as caused by that person. A smile already installed on your face reads as weather.' },
  { name: 'Get to eye level', text: 'Sit if they are sitting. Height differential during a disagreement reads as dominance and raises defensiveness, regardless of intent. Cheapest de-escalation move there is.' },
  { name: 'Turn your whole body', text: 'Rotate the torso to face whoever is speaking, not just the head. Head-only turns read as partial attention because they are.' },
  { name: 'Take your space', text: 'Do not shrink — no collapsing the chest, no pinning the elbows in. Note the honest version: observers reliably read expansive posture as confident, but the famous claim that holding a pose changes your hormones failed to replicate. Do it because of how it reads and because it stops you rehearsing smallness, not because of cortisol.' },
  { name: 'Slow down', text: 'Rushed speech and rushed movement both signal that you expect to be interrupted or dismissed. Unhurried is the single most legible confidence cue you control.' },
];

/* Named plainly, because these are everywhere in this genre and every one of
   them will make you read people worse. */
const DEBUNKED = [
  {
    myth: 'Eye direction reveals lying — looking one way is memory, the other is fabrication',
    origin: 'Neuro-linguistic programming (Bandler & Grinder, 1970s)',
    verdict: 'myth',
    detail: 'Tested directly by Wiseman et al. (2012) across three studies, including real-world lies. No relationship between eye direction and deception. The underlying "left brain logical, right brain creative" framing is also not how brain lateralisation works.',
    instead: 'There is no reliable nonverbal tell for lying. Use content: verifiable detail, consistency over retellings, and what they had reason to know.',
  },
  {
    myth: 'Communication is 7% words, 38% tone, 55% body language',
    origin: 'Two small Mehrabian studies, 1967',
    verdict: 'myth',
    detail: 'The studies measured how people resolve INCONGRUENT signals about liking — single words spoken in mismatched tones. Mehrabian himself repeatedly said the formula does not generalise to communication at large. If it were true you could follow a lecture in a language you do not speak.',
    instead: 'Nonverbals dominate for affect and attitude. Words dominate for content. Which matters depends entirely on what is being communicated.',
  },
  {
    myth: 'You can learn to spot liars from their body language',
    origin: 'Popular training courses, police folklore',
    verdict: 'myth',
    detail: 'Bond & DePaulo\'s meta-analysis of hundreds of studies puts average lie-detection accuracy near 54% — barely above a coin flip — and "experts" do not beat laypeople. Confidence rises with training while accuracy does not, which is the worst possible combination.',
    instead: 'Assume you cannot tell. Rely on verification, incentives, and track record.',
  },
  {
    myth: 'Power posing raises testosterone and lowers cortisol',
    origin: 'Carney, Cuddy & Yap 2010',
    verdict: 'myth',
    detail: 'The hormonal and risk-taking findings failed to replicate in a larger, better-powered study (Ranehill et al. 2015), and the first author later stated she no longer believes the effect is real. Self-reported feelings of power show a small effect at best.',
    instead: 'Posture still matters for how others read you, and standing tall beats rehearsing smallness. Just do not expect an endocrine event.',
  },
  {
    myth: 'Crossed arms means defensive or closed off',
    origin: 'Pop body-language books',
    verdict: 'myth',
    detail: 'No reliable one-to-one mapping exists between a single gesture and an internal state. People cross their arms because they are cold, because the chair has no armrests, or because it is comfortable.',
    instead: 'Baseline plus clusters. A gesture only carries information as a deviation from how that specific person normally sits.',
  },
  {
    myth: 'Mirroring someone deliberately builds rapport',
    origin: 'Sales and NLP training',
    verdict: 'mixed',
    detail: 'Synchrony genuinely accompanies rapport, but the causal arrow is mostly rapport → synchrony. Deliberate mimicry shows small effects at best and backfires badly when detected.',
    instead: 'Treat synchrony as a dial you read, not a lever you pull.',
  },
];

/* -------------------------------------------------------------------------
   WARMTH & STANDARDS  (what "hot and cold" is actually pointing at)

   The folk version says: alternate warmth and withdrawal to create tension.
   That framing is wrong on the mechanism. Warmth and standards are not two
   ends of one dial — they are two independent axes, and the attractive
   position is high on BOTH at once, not oscillating between them.
   ------------------------------------------------------------------------- */

const WARMTH_MODEL = {
  axes: {
    warmth: 'How safe, liked, and seen the other person feels around you.',
    standards: 'How much of yourself you keep when the other person\'s approval is available for sale.',
  },
  quadrants: [
    { warmth: 'low', standards: 'low', name: 'Absent', reads: 'Forgettable. No signal in either direction.' },
    { warmth: 'high', standards: 'low', name: 'Eager', reads: 'Instantly available, agrees with everything, reorganises around them. Reads as need, and need is not attractive — not because people are cruel, but because it says nothing else in your life is compelling.' },
    { warmth: 'low', standards: 'high', name: 'Cold', reads: 'Withholding, aloof, hard to reach. Often mistaken for the goal. It reads as contempt or fear, and it is self-protection wearing self-respect\'s clothes.' },
    { warmth: 'high', standards: 'high', name: 'Warm with a spine', reads: 'Genuinely glad to see you AND unwilling to shrink. This is the whole target. The warmth makes it safe; the standards make it mean something.' },
  ],
  key: 'The "cold" people are reaching for is not withdrawal of warmth. It is the visible presence of a self that was never up for negotiation. You can be maximally warm and still be someone who says no.',
};

const WARMTH_MOVES = [
  { name: 'The clean no', axis: 'standards', text: 'Say no without the cushion. No hedging paragraph, no apology, no alternative offered purely to manage their reaction. "I can\'t do that" is a complete sentence. Not rude — clear.' },
  { name: 'Disagree agreeably', axis: 'both', text: 'Hold the disagreement and the warmth simultaneously: "I think you\'re completely wrong, and I want to hear why you think that." Most people can do one or the other. Doing both is rare and reads as strength.' },
  { name: 'Warm teasing', axis: 'both', text: 'A jab wrapped in obvious affection. It signals: I pay enough attention to notice something playful about you, and I feel safe enough to play. Punch up or sideways, never down, and never at a real insecurity.' },
  { name: 'Have a life you are reluctant to interrupt', axis: 'standards', text: 'Not manufactured busyness — actual things you care about. Constant availability is not generous, it broadcasts that nothing else is compelling. This is the honest version of "don\'t be too available", and it works because it is true, not because it is a tactic.' },
  { name: 'State what you want', axis: 'standards', text: 'Say plainly what you are looking for, early, without checking whether it scares them. Clarity is rare enough to be magnetic on its own, and it treats the other person as an adult who deserves real information.' },
  { name: 'Let it end', axis: 'standards', text: 'No chasing after a fade. Anxious pursuit is not devotion — it is a nervous system relieving its own discomfort (Hazan & Shaver). Letting something end cleanly is the single clearest signal that your presence is not something to be begged for.' },
  { name: 'Tolerate disapproval', axis: 'standards', text: 'Separate two things your nervous system treats as identical: someone being disappointed in you, and you being wrong. They are unrelated. Most self-abandonment happens in the gap between them.' },
  { name: 'Go first', axis: 'warmth', text: 'Offer the disclosure before asking for one. You cannot rally until someone serves. Going first is a warmth move that costs status only in your imagination.' },
];

const ANTI_PATTERN = {
  name: 'Why deliberate hot/cold fails',
  text:
    'The manipulative version — deliberately alternating attention and withdrawal to keep someone off balance — is intermittent reinforcement. It does generate a behavioural response; that is why it has a reputation. But what it generates is anxiety, not attraction, and the two feel similar from the inside only at the start.',
  consequences: [
    'It selects for anxiously-attached partners, because those are the people the mechanism works on. You end up with exactly the relationship dynamic you would not choose.',
    'It requires ongoing management, so you never get to relax, and the version of you they liked was never you.',
    'It is corrosive to the trust the escalation staircase runs on, which caps the relationship at the depth where you started performing.',
  ],
  instead: 'Warmth plus standards produces the same magnetic quality with none of the maintenance, because it is not a performance. The pull people feel around a self-respecting warm person is the absence of need, not the presence of a technique.',
};

/* -------------------------------------------------------------------------
   IDENTITY

   The direction of causation matters. Affirmations run identity → behaviour
   and largely fail. Self-perception runs behaviour → evidence → identity,
   and that direction actually moves.
   ------------------------------------------------------------------------- */

const IDENTITY_MODEL = {
  principle:
    'You infer what kind of person you are largely by watching what you do (Bem, self-perception theory). This means identity is downstream of evidence, not upstream of it. Repeating "I am confident" while behaving timidly teaches you the opposite, because your own behaviour is the more credible witness.',
  loop: [
    { step: 'Name the identity', text: 'Specific and behavioural. Not "I am charismatic" but "I am someone who says the honest thing instead of the safe thing."' },
    { step: 'Find the smallest action that would only be true of that person', text: 'It has to be small enough that you will actually do it today, and specific enough that doing it is unambiguous evidence.' },
    { step: 'Do it, then log it', text: 'The log is not admin. It is the evidence file your self-concept reads from. Unlogged wins get forgotten; the doubts never do.' },
    { step: 'Let the identity update', text: 'After enough entries the claim stops being aspirational and starts being a description. That is the whole mechanism.' },
  ],
  warning:
    'The failure mode here is Musaed\'s own documented risk: reading the loop and not running it. An identity file with zero entries is a reading list.',
};

const IDENTITY_LADDERS = [
  {
    identity: 'I am someone who says the honest thing instead of the safe thing',
    rungs: [
      'Give one real opinion where you would normally say "yeah, no, it\'s fine".',
      'Tell someone what you actually thought of a thing they recommended.',
      'Disagree out loud, warmly, with someone whose approval you want.',
      'Say the uncomfortable true thing in a room where it costs you something.',
    ],
  },
  {
    identity: 'I am someone who takes up his space',
    rungs: [
      'Speak once, unprompted, in a meeting or group where you would normally stay quiet.',
      'Finish a sentence someone tried to talk over.',
      'Hold a pause after a question instead of rushing to fill it.',
      'Give an opinion in a room where you are the least senior person.',
    ],
  },
  {
    identity: 'I am someone who does not need this to go well',
    rungs: [
      'Start one conversation with a stranger and let it go nowhere.',
      'Let a text sit unanswered for an evening without drafting three versions.',
      'Leave a conversation first, while it is still going well.',
      'Let something end without a follow-up attempt to reopen it.',
    ],
  },
  {
    identity: 'I am someone who goes first',
    rungs: [
      'Offer one opinion before asking for theirs.',
      'Volunteer something mildly embarrassing about yourself, with amusement.',
      'Use the preface — "can I ask you something honest?" — once, for real.',
      'Tell someone plainly what you like about them, to their face.',
    ],
  },
  {
    identity: 'I am someone who tells stories, not summaries',
    rungs: [
      'Answer one "how was your weekend" with a 30-second story instead of a word.',
      'Use a hook before a story: "okay, you\'re going to love this".',
      'Do one voice or one gesture inside a story instead of narrating flatly.',
      'Land a story on a laugh or a lesson rather than trailing off into "yeah, anyway".',
    ],
  },
];

/* Storytelling gets its own block because it is the highest-leverage single
   skill in the whole app — it is how everything else becomes visible. */
const STORY_STRUCTURE = [
  { part: 'Hook', text: 'One line that buys attention before you spend it. "Okay, you\'re going to love this." Works in any context, but you must then deliver.' },
  { part: 'Scene', text: 'Under 30 seconds. Include only details that pay off later. Setting people up to guess wrong is worse than not setting up at all — they feel cheated at the end.' },
  { part: 'Stakes', text: 'Say your internal monologue out loud: "and I\'m thinking, oh no, this is bad." This is what makes a listener feel the drop rather than hear about it.' },
  { part: 'Embodiment', text: 'Present tense. Do the voices. Use your hands. The content matters less than whether the audience feels the ride.' },
  { part: 'Pacing', text: 'Speed up to make them feel out of control. Slow down to hang them in anticipation. Uniform pace is why true stories land flat.' },
  { part: 'False ending', text: 'Spend your second-best material on a moment that could plausibly end the story — then keep going. Massively underused, and the single biggest upgrade available to most storytellers.' },
  { part: 'Land it', text: 'End on a laugh or a lesson. Do not trail off. An epilogue that names what it meant turns entertainment into something that changes the listener.' },
  { part: 'Accept the challenge', text: 'The real skill is choosing to tell one at all. Most openings look like an ordinary question you could answer in a sentence. Taking the longer road is the confident move.' },
];

/* Conversation moves — the practical layer over the mechanisms. */
const CONVO_MOVES = [
  { name: 'The preface', text: '"Can I ask you something honest?" Converts an ambush into an invitation, gets a micro-commitment to openness, and spikes curiosity so hard that refusal is nearly unheard of. Once per conversation, twice at most — it is a doorbell, not a hammer.' },
  { name: 'Go deeper or go different', text: 'When a thread stalls you have exactly two moves. Deeper: ask the reason behind the fact ("what made you choose that?"). Different: stop asking and make a statement or a guess they can react to. Reactions create emotion; questions only create answers.' },
  { name: 'The echo', text: 'What an experience symbolises is broader than the experience. You do not fish — but they might love fishing for the solitude, and you know solitude. Common ground is far more often "I felt the same thing for a different reason" than "that happened to me too".' },
  { name: 'The golden thread', text: 'Every answer contains free hooks. "I moved here for a new job" offers three. Follow the turnoff instead of returning to your own agenda and you never run out of material.' },
  { name: 'Callbacks', text: 'Reference something from earlier in the conversation. It manufactures shared history, which is most of what a relationship actually is. Jumping topic to topic resets the interaction every time.' },
  { name: 'Let it breathe', text: 'Silence is not an emergency. Three or four seconds of comfortable quiet reads as security; scrambling to fill it reads as anxiety. Doing nothing is the easiest fix in this entire app.' },
  { name: 'Hide the Mona Lisa', text: 'Sometimes the socially skilled move is to not tell your better story, because the other person is enjoying theirs. Knowing when not to speak beats having more material.' },
  { name: 'Kill the dead-end question', text: '"How are you" purchases "good, you?". Trade it for "what was the best part of your week?" — a question that gives them room to complain, brag, or tell a story.' },
];

window.READ_CONTENT = {
  MECHANISMS, BODY_PRINCIPLES, BODY_CUES, BODY_YOURS, DEBUNKED,
  WARMTH_MODEL, WARMTH_MOVES, ANTI_PATTERN,
  IDENTITY_MODEL, IDENTITY_LADDERS, STORY_STRUCTURE, CONVO_MOVES,
};
