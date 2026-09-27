/**
 * Casey speaks as a player, never as the machinery behind him.
 *
 * The owner, after the strengths landed (2026-09-06): "now Casey in its
 * thinking out loud, what the player sees, talks about index and strength
 * numbers. The player has no idea what that is. Casey should talk as if he
 * was a player." The rationale of a clue and the reasoning of a guess are
 * shown to the player — in the reveal beat and in the round summary — and
 * they had started to echo the private sections of the prompt: the index,
 * the LCSI ranks, floors, margins, "the board was built around this".
 *
 * Two layers, both here. The RULE is the sentence both prompts carry. The
 * GUARD is the check the orchestrator runs on every rationale and reasoning:
 * a mention of the private vocabulary is a problem, corrected the same way an
 * illegal clue is, so the player never reads one even when the model forgets.
 * The words are the prompt's own terms of art; "strong", "weak", "fits",
 * "pulls" and other ordinary English stay allowed, and so does a whole
 * number — "two of three" is a player's sentence — while a decimal is not,
 * because nothing a player sees has one.
 *
 * The RULE stays in English because the prompt does. The GUARD does not: it
 * reads what Casey wrote, and since Phase 4 that is the player's language.
 */
export const PLAYER_VOICE_RULE =
  'YOUR PARTNER READS YOUR RATIONALE AND REASONING, in this app, in your voice. Write them as a fellow player would: about what the words mean and why one fits and another does not. The private advice you are given — the index, its links, the strengths, ranks, rungs, floors, ceilings, margins, corpus degrees, the authored groups and path, and any number from them — is for your eyes only. Never name it, quote a figure from it, or say a clue was "built for" or "made for" the board. If you used it, say what it told you in plain words ("hund pulls harder than hest here") and nothing about where it came from.'

const PRIVATE_TERMS = [
  /\bLCSI\b/i,
  /\bindex(?:ed|es)?\b/i,
  /\bcorpus\b/i,
  /\brungs?\b/i,
  /\bmargins?\b/i,
  /\bstrengths?\b/i,
  /\branks?\b|\branked\b|\branking\b/i,
  /\bprecomputed\b/i,
  /\bauthored\b/i,
  /\btarget floor\b/i,
  /\bbystander ceiling\b/i,
  /\bbuilt (?:for|around)\b/i,
  /\bmade for (?:this|the) board\b/i,
  /\bdegree\b/i,
  /\b\d+\.\d+\b/,
  // Casey now writes the rationale and the reasoning in the player's language
  // (player-language.js), so a guard that only knows English terms of art no
  // longer guards anything for a German, Spanish or Chinese player. These are
  // the same words, in the same narrow sense: the prompt's private vocabulary,
  // not ordinary description. "Index" and a decimal are already caught above
  // in every language.
  // `\b` is defined on [A-Za-z0-9_] alone, so it finds no boundary beside ä, ö
  // or í and would quietly never fire on the words that need it most. These use
  // a unicode-aware edge instead.
  /(?<!\p{L})(?:Korpus|Rang|Ränge|Rangfolge|Marge|Stärkewert|Zielsohle|vorberechnet)(?!\p{L})/iu,
  /(?<!\p{L})gebaut (?:für|um)(?!\p{L})/iu,
  /(?<!\p{L})(?:índice|rango|margen|márgenes|preclasificad[oa]s?)(?!\p{L})/iu,
  /(?<!\p{L})construid[oa] para(?!\p{L})/iu,
  // Chinese is written without spaces, so any word boundary would never match.
  /索引|语料库|排名|边际|强度值|目标下限|为(?:这个|该)棋盘(?:打造|设计)/,
]

/** The first private term a player-facing sentence lets slip, or null when it is clean. */
export function privateAdviceMentioned(text) {
  if (typeof text !== 'string') return null
  for (const pattern of PRIVATE_TERMS) {
    const match = pattern.exec(text)
    if (match) return match[0]
  }
  return null
}

/**
 * No em dashes in anything the player reads (owner, 2026-09-26: "look for all
 * remaining em dashes in the app"). The prompts are full of them and the model
 * writes the way it is written to, so this is applied, not asked for: a
 * dash becomes a comma, a Chinese double dash a full-width comma. A SPACED en
 * dash is the German and Nordic way to write the same pause and goes too; an
 * unspaced one, "13–15", is a range and stays.
 */
export function withoutDashes(text) {
  if (typeof text !== 'string') return text
  return text
    .replace(/\s*——\s*/g, '，')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/,\s*([,.;:!?])/g, '$1')
    .replace(/^,\s*/, '')
}

/** The correction the model receives when a rationale or reasoning leaks. */
export function playerVoiceProblem(field, term) {
  return `your ${field} mentions "${term}" — the index, strengths, ranks, margins, floors, groups and their numbers are private to you and your partner never sees them. Rewrite the ${field} as a fellow player would, about what the words mean and why one fits and another does not, with no figures and no mention of where the advice came from`
}
