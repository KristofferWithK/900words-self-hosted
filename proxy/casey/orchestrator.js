import { evaluatorForBoard, engineTrapIds } from './evaluator.js'
import {
  buildClueAssociationContext,
  buildGuessAssociationContext,
  clueAssociationCandidates,
  guessAssociationLookup,
} from './association-index.js'
import { authoredClueCandidates, authoredFirstClue, buildAuthoredClueContext, isAuthoredBoardId } from './authored-clues.js'
import { authoredPlayerGuesses } from './authored-player-clues.js'
import { normalize } from './language.js'
import { languageFor } from './languages.js'
import { DEFAULT_PLAYER_LANGUAGE, isPlayerLanguage, playerLanguageFor } from './player-language.js'
import { aiGuessableIds, aiTargetableIds } from './projections.js'
import { buildCluePrompt, buildGuessPrompt, buildTranslatePrompt } from './prompts.js'
import { playerVoiceProblem, privateAdviceMentioned, withoutDashes } from './voice.js'

export const CASEY_PROTOCOL = 1
export const MAX_REQUEST_BYTES = 64 * 1024
const MAX_MODEL_REPLY_BYTES = 128 * 1024
const MAX_CORRECTIONS = 3
const THETA = 0.5

export class CaseyServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'CaseyServiceError'
    this.code = code
    this.status = status
  }
}

const fail = (message) => {
  throw new CaseyServiceError('invalid_request', message, 400)
}

const plainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function exactObject(value, keys, at) {
  if (!plainObject(value)) fail(`${at} must be an object`)
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${at}.${key} is not part of the Casey protocol`)
  }
  return value
}

function text(value, at, max, { empty = false } = {}) {
  if (typeof value !== 'string') fail(`${at} must be a string`)
  if ((!empty && value.trim() === '') || value.length > max) {
    fail(`${at} must be ${empty ? 'at most' : 'between 1 and'} ${max} characters`)
  }
  return value
}

function integer(value, at, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${at} must be an integer from ${min} to ${max}`)
  }
  return value
}

function list(value, at, max) {
  if (!Array.isArray(value) || value.length > max) fail(`${at} must be an array of at most ${max}`)
  return value
}

function reveal(value, at) {
  const object = exactObject(value, ['kind', 'against'], at)
  if (object.kind === 'hidden' || object.kind === 'green') {
    if ('against' in object) fail(`${at}.against is only valid for a neutral reveal`)
    return { kind: object.kind }
  }
  if (object.kind !== 'bystander') fail(`${at}.kind is invalid`)
  const against = list(object.against, `${at}.against`, 2)
  if (against.length === 0 || against.some((side) => side !== 'ai' && side !== 'player')) {
    fail(`${at}.against must name ai and/or player`)
  }
  return { kind: 'bystander', against: [...new Set(against)] }
}

function publicWord(value, at, withRole) {
  const object = exactObject(
    value,
    withRole ? ['id', 'da', 'en', 'pos', 'reveal', 'roleOnMyKey'] : ['id', 'da', 'en', 'pos', 'reveal'],
    at,
  )
  const en = list(object.en, `${at}.en`, 6).map((item, index) => text(item, `${at}.en[${index}]`, 80))
  if (en.length === 0) fail(`${at}.en must not be empty`)
  const word = {
    id: text(object.id, `${at}.id`, 80),
    da: text(object.da, `${at}.da`, 80),
    en,
    pos: text(object.pos, `${at}.pos`, 32),
    reveal: reveal(object.reveal, `${at}.reveal`),
  }
  if (withRole) {
    if (object.roleOnMyKey !== 'green' && object.roleOnMyKey !== 'bystander') {
      fail(`${at}.roleOnMyKey is invalid`)
    }
    word.roleOnMyKey = object.roleOnMyKey
  }
  return word
}

function history(value) {
  return list(value, 'view.history', 24).map((entry, i) => {
    const at = `view.history[${i}]`
    const object = exactObject(entry, ['by', 'text', 'number', 'guesses'], at)
    if (object.by !== 'ai' && object.by !== 'player') fail(`${at}.by is invalid`)
    return {
      by: object.by,
      text: text(object.text, `${at}.text`, 80),
      number: integer(object.number, `${at}.number`, 1, 4),
      guesses: list(object.guesses, `${at}.guesses`, 24).map((guess, j) => {
        const guessAt = `${at}.guesses[${j}]`
        const row = exactObject(guess, ['da', 'result'], guessAt)
        if (row.result !== 'green' && row.result !== 'bystander') fail(`${guessAt}.result is invalid`)
        return { da: text(row.da, `${guessAt}.da`, 80), result: row.result }
      }),
    }
  })
}

function flags(value) {
  return list(value, 'view.flagged', 6).map((entry, i) => {
    const at = `view.flagged[${i}]`
    const object = exactObject(entry, ['kind', 'what', 'underClue', 'why'], at)
    if (object.kind !== 'clue' && object.kind !== 'guess') fail(`${at}.kind is invalid`)
    return {
      kind: object.kind,
      what: text(object.what, `${at}.what`, 120),
      ...(object.underClue === undefined
        ? {}
        : { underClue: text(object.underClue, `${at}.underClue`, 80) }),
      ...(object.why === undefined ? {} : { why: text(object.why, `${at}.why`, 500, { empty: true }) }),
    }
  })
}

function commonView(value, kind, withRole) {
  // `boardId` names the authored City 1 board a view is playing. On a clue
  // view it lets the Worker hand Casey his own clue groups (authored-clues.js);
  // on a guess view it lets the Worker answer a clue the board was made for
  // with certainty (authored-player-clues.js, owner call of 2026-09-06). It
  // names a board, never a key: the view itself still carries none.
  const keys = withRole
    ? ['kind', 'clueLanguage', 'turnsLeft', 'words', 'history', 'flagged', 'boardId']
    : ['kind', 'clueLanguage', 'turnsLeft', 'words', 'currentClue', 'history', 'flagged', 'boardId']
  const object = exactObject(value, keys, 'view')
  if (object.kind !== kind) fail(`view.kind must be ${kind}`)
  // `clueLanguage` is accepted and dropped. The setting behind it is gone
  // (owner, 2026-09-11) and Casey clues in the language being learned either
  // way; the key stays in the allowed list only so a client built before this
  // deploy keeps working. Nothing downstream reads it.
  const words = list(object.words, 'view.words', 24).map((word, i) =>
    publicWord(word, `view.words[${i}]`, withRole),
  )
  if (words.length === 0) fail('view.words must not be empty')
  if (new Set(words.map((word) => word.id)).size !== words.length) fail('view.words contains duplicate ids')
  const view = {
    kind,
    turnsLeft: integer(object.turnsLeft, 'view.turnsLeft', 0, 20),
    words,
    history: history(object.history),
    flagged: flags(object.flagged),
  }
  if (object.boardId !== undefined) {
    if (!isAuthoredBoardId(object.boardId)) fail('view.boardId is not an authored board id')
    view.boardId = object.boardId
  }
  if (!withRole) {
    const current = exactObject(object.currentClue, ['text', 'number'], 'view.currentClue')
    view.currentClue = {
      text: text(current.text, 'view.currentClue.text', 80),
      number: integer(current.number, 'view.currentClue.number', 1, 4),
    }
  }
  return view
}

/**
 * The language the player already speaks, which is the language Casey writes
 * her rationale and reasoning in. Optional on the wire and English when it is
 * missing, so a client built before this deploy gets exactly what it got
 * before. It is a CODE, never copy: the strings themselves are the Worker's.
 */
function requestedPlayerLanguage(object) {
  if (object.playerLanguage === undefined) return DEFAULT_PLAYER_LANGUAGE.code
  if (typeof object.playerLanguage !== 'string' || !isPlayerLanguage(object.playerLanguage)) {
    fail('request.playerLanguage is invalid')
  }
  return object.playerLanguage
}

/** Strictly parse the only payload the browser is allowed to send. */
function parseLanguageDecisionRequest(value) {
  const object = exactObject(
    value,
    ['protocol', 'operation', 'view', 'term', 'candidateMode', 'playerLanguage', 'language'],
    'request',
  )
  if (object.protocol !== CASEY_PROTOCOL) fail(`request.protocol must be ${CASEY_PROTOCOL}`)
  if (!['clue', 'guess', 'translate', 'ping'].includes(object.operation)) {
    fail('request.operation is invalid')
  }
  const playerLanguage = requestedPlayerLanguage(object)
  if (object.operation === 'clue') {
    if ('term' in object) fail('request.term is not valid for a clue')
    if ('candidateMode' in object) fail('request.candidateMode is not valid for a clue')
    return {
      protocol: CASEY_PROTOCOL,
      operation: 'clue',
      playerLanguage,
      view: commonView(object.view, 'ai-clue', true),
    }
  }
  if (object.operation === 'guess') {
    if ('term' in object) fail('request.term is not valid for a guess')
    if (object.candidateMode !== undefined && object.candidateMode !== 'top-two') {
      fail('request.candidateMode is invalid')
    }
    return {
      protocol: CASEY_PROTOCOL,
      operation: 'guess',
      playerLanguage,
      view: commonView(object.view, 'ai-guess', false),
      ...(object.candidateMode ? { candidateMode: object.candidateMode } : {}),
    }
  }
  if (object.operation === 'translate') {
    if ('view' in object) fail('request.view is not valid for a translation')
    if ('candidateMode' in object) fail('request.candidateMode is not valid for a translation')
    return {
      protocol: CASEY_PROTOCOL,
      operation: 'translate',
      playerLanguage,
      term: text(object.term, 'request.term', 80),
    }
  }
  if ('view' in object || 'term' in object || 'candidateMode' in object) fail('a ping carries no game data')
  return { protocol: CASEY_PROTOCOL, operation: 'ping', playerLanguage }
}

function jsonFromModel(content) {
  if (typeof content !== 'string' || content.length === 0 || content.length > MAX_MODEL_REPLY_BYTES) {
    throw new Error('the reply was empty or too large')
  }
  const stripped = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  try {
    return JSON.parse(stripped)
  } catch {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(stripped.slice(start, end + 1))
    throw new Error('the reply was not a single valid JSON object')
  }
}

function parseClue(value) {
  if (!plainObject(value)) return { problem: 'the reply is not an object' }
  if (typeof value.clue !== 'string' || value.clue.trim() === '' || value.clue.length > 80) {
    return { problem: 'clue is missing or too long' }
  }
  if (!Number.isInteger(value.number) || value.number < 1 || value.number > 4) return { problem: 'number must be 1-4' }
  if (
    !Array.isArray(value.targetWordIds) ||
    value.targetWordIds.length === 0 ||
    value.targetWordIds.length > 4 ||
    value.targetWordIds.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 80)
  ) {
    return { problem: 'targetWordIds must contain 1-4 bounded word ids' }
  }
  if (typeof value.rationale !== 'string' || value.rationale.length > 1000) {
    return { problem: 'rationale is missing or too long' }
  }
  return {
    value: {
      clue: value.clue,
      number: value.number,
      targetWordIds: value.targetWordIds,
      rationale: value.rationale,
    },
  }
}

function parseGuesses(value) {
  if (
    !plainObject(value) ||
    !Array.isArray(value.guesses) ||
    value.guesses.length === 0 ||
    value.guesses.length > 24
  ) {
    return { problem: 'guesses must contain 1-24 rows' }
  }
  const guesses = []
  for (const guess of value.guesses) {
    if (
      !plainObject(guess) ||
      typeof guess.wordId !== 'string' ||
      guess.wordId.length === 0 ||
      guess.wordId.length > 80 ||
      typeof guess.confidence !== 'number' ||
      !Number.isFinite(guess.confidence) ||
      guess.confidence < 0 ||
      guess.confidence > 1 ||
      typeof guess.reasoning !== 'string' ||
      guess.reasoning.length > 500
    ) {
      return { problem: 'a guess has the wrong shape' }
    }
    guesses.push({ wordId: guess.wordId, confidence: guess.confidence, reasoning: guess.reasoning })
  }
  return { value: { guesses } }
}

function parseTranslation(value, language = 'da') {
  const allowed = new Set(['da', 'en', 'article', 'gender', 'countable', 'note'])
  if (
    !plainObject(value) ||
    Object.keys(value).some((key) => !allowed.has(key)) ||
    typeof value.da !== 'string' ||
    !value.da.trim() ||
    value.da.length > 120 ||
    typeof value.en !== 'string' ||
    !value.en.trim() ||
    value.en.length > 120
  ) {
    return { problem: 'translation requires da and en' }
  }
  const articles = language === 'de' ? ['ein', 'eine'] : ['en', 'et']
  const genders = language === 'de' ? ['masculine', 'feminine', 'neuter'] : ['common', 'neuter']
  if (value.article !== undefined && !articles.includes(value.article)) return { problem: 'article is invalid' }
  if (value.gender !== undefined && !genders.includes(value.gender)) return { problem: 'gender is invalid' }
  if (value.countable !== undefined && typeof value.countable !== 'boolean') return { problem: 'countable is invalid' }
  if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length > 500)) {
    return { problem: 'note is invalid' }
  }
  return {
    value: {
      da: value.da.trim(),
      en: value.en.trim(),
      ...(value.article === undefined ? {} : { article: value.article }),
      ...(value.gender === undefined ? {} : { gender: value.gender }),
      ...(value.countable === undefined ? {} : { countable: value.countable }),
      ...(value.note === undefined ? {} : { note: value.note.trim() }),
    },
  }
}

const correction = (problem) => ({
  role: 'user',
  content: `That response was invalid: ${problem}. Reply again with ONLY a corrected JSON object.`,
})

async function askValidated(askModel, messages, parse, validate, temperature, giveUp) {
  const conversation = [...messages]
  let problem = 'no reply was ever valid'
  for (let attempt = 0; attempt <= MAX_CORRECTIONS; attempt++) {
    const temp = Math.min(1, temperature + Math.max(0, attempt - 1) * 0.2)
    let content
    try {
      content = await askModel(conversation, { temperature: temp, escalate: attempt > 0 })
    } catch (error) {
      if (!(error instanceof CaseyServiceError) || error.code !== 'invalid_model_reply') throw error
      problem = error.message
      conversation.push(correction(problem))
      continue
    }
    let raw
    try {
      raw = jsonFromModel(content)
    } catch {
      problem = 'the reply was not a single valid JSON object'
      conversation.push(correction(problem))
      continue
    }
    const shaped = parse(raw)
    if (!shaped.value) {
      problem = shaped.problem
      conversation.push({ role: 'assistant', content: JSON.stringify(raw) }, correction(problem))
      continue
    }
    const checked = validate(shaped.value)
    if (checked.value) return { value: checked.value, attempts: attempt }
    problem = checked.problem
    conversation.push({ role: 'assistant', content: JSON.stringify(raw) }, correction(problem))
  }
  console.warn(`casey: gave up after ${MAX_CORRECTIONS} corrections: ${problem}`)
  throw new CaseyServiceError('invalid_model_reply', giveUp, 502)
}

function evaluatorProblem(view, clue, targets) {
  const evaluator = evaluatorForBoard(view)
  if (!evaluator) return null
  const traps = engineTrapIds(view)
  // Mixed or incompletely authored boards get ordinary model-backed play. The
  // authored shard advises only when it knows the whole decision surface.
  if (![...targets, ...traps].every((id) => evaluator.has(id))) return null
  const score = evaluator.scoreClue(clue, targets, traps)
  if (score.margin >= THETA) return null
  const weak = targets
    .map((id) => ({ id, sim: evaluator.sim(clue, id) }))
    .sort((a, b) => a.sim - b.sim || a.id.localeCompare(b.id))[0]
  const targetName = view.words.find((word) => word.id === weak.id)?.da ?? weak.id
  if (score.riskiest) {
    const neutralName = view.words.find((word) => word.id === score.riskiest.id)?.da ?? score.riskiest.id
    // Do not place authored book prose in a corrective prompt. The evaluator
    // may steer the model, but even a prompt-injected model must have no corpus
    // rationale available to echo into the final decision.
    return `evaluator check: “${clue}” pulls neutral ${neutralName} (${score.riskiest.sim}) as much as weak target ${targetName} (${weak.sim}); choose a safer clue`
  }
  return `evaluator check: “${clue}” reaches weak target ${targetName} only ${weak.sim}; choose a clearer clue`
}

/**
 * Casey always plays. A human partner does not fall silent because they could
 * not think of anything, and neither may Casey (owner, 2026-09-07): when the
 * model gives up — no valid reply after the corrections, or no model at all
 * because the upstream did not answer — the Worker gives the best clue its
 * own data can stand behind, checked by the very same validator the model's
 * reply had to pass, and guesses from the index the same way. The ledger
 * arm says so (`<arm>+fallback-<source>`), so no round credits the model with
 * a call it did not make. A quota stop and a misconfigured server are not
 * model failures and still surface as before.
 */
const FALLBACK_AFTER = new Set(['invalid_model_reply', 'upstream_unavailable', 'upstream_error', 'upstream_rate_limit'])
const fallsBack = (error) => error instanceof CaseyServiceError && FALLBACK_AFTER.has(error.code)

const nameOf = (view, id) => view.words.find((word) => word.id === id)?.da ?? id
// Bare words in, quoted list out: the marks a language quotes a board word
// with are the language's business. Wrapping them here in « » put a French
// convention into the Chinese sentence.
const listNames = (view, ids, player) => player.joinNames(ids.map((id) => nameOf(view, id)))

/**
 * What the player reads after the turn: the connection and the near miss, in a
 * player's words — and in the player's language. No model wrote this one, so
 * unlike a rationale it cannot be instructed into German; the Worker owns the
 * sentence and every language of it (player-language.js).
 */
function fallbackRationale(view, targets, riskiest, player) {
  const base = player.oneIdea(listNames(view, targets, player))
  return riskiest ? player.alsoCameToMind(base, nameOf(view, riskiest)) : player.onlyIdea(base)
}

/**
 * The rationale the player reads under the bank's opening clue, in Casey's
 * voice per the authored-player-clues pattern: it explains the group's link,
 * and never mentions the bank, the board, or the key — the opening is
 * delivered instantly, so an announcement of the mechanism would read as a
 * confession that no thought happened at all.
 */
function firstClueRationale(view, opening, player) {
  const names = listNames(view, opening.targetWordIds, player)
  return player.firstClue(opening.clue, names)
}

/** The strongest live neutral a candidate row knows about, or its first, or none. *//** The strongest live neutral a candidate row knows about, or its first, or none. */
function riskiestOf(candidate) {
  const scored = (candidate.strength?.neutrals ?? []).filter((n) => n.score !== null).sort((a, b) => b.score - a.score)
  return scored[0]?.id ?? candidate.otherBoardWordIds?.[0] ?? null
}

/**
 * Clues the city's own book can stand behind, for boards the bank and the
 * index do not cover: every association the book lists for a word Casey still
 * holds, read as a clue for all the held words it scores 2 or better on, best
 * margin first. The validator, not this list, decides what is good enough.
 */
function bookClueCandidates(view) {
  const evaluator = evaluatorForBoard(view)
  if (!evaluator) return []
  const targetable = aiTargetableIds(view)
  const traps = engineTrapIds(view)
  const seen = new Set()
  const candidates = []
  for (const id of targetable) {
    for (const entry of evaluator.assocFor(id)) {
      // Always the Danish side: the clue is in the language being learned, and
      // the book's English column was only ever read by the retired setting.
      const clue = entry.da
      if (typeof clue !== 'string' || !clue.trim() || seen.has(normalize(clue))) continue
      seen.add(normalize(clue))
      const targets = targetable
        .map((target) => ({ target, sim: evaluator.sim(clue, target) }))
        .filter((t) => t.sim >= 2)
        .sort((a, b) => b.sim - a.sim || a.target.localeCompare(b.target))
        .slice(0, 4)
        .map((t) => t.target)
      if (targets.length === 0) continue
      const score = evaluator.scoreClue(clue, targets, traps)
      candidates.push({ clue, targetWordIds: targets, riskiest: score.riskiest?.id ?? null, margin: score.margin, source: 'book' })
    }
  }
  return candidates.sort(
    (a, b) => b.targetWordIds.length - a.targetWordIds.length || b.margin - a.margin || a.clue.localeCompare(b.clue),
  )
}

/** Bank groups first, then the index, then the book — each already ordered best first. */
function* fallbackClueCandidates(view) {
  for (const c of authoredClueCandidates(view)) {
    yield { clue: c.clue, targetWordIds: c.targetWordIds, riskiest: riskiestOf(c), source: 'bank' }
  }
  for (const c of clueAssociationCandidates(view)) {
    yield { clue: c.clue, targetWordIds: c.targetWordIds, riskiest: riskiestOf(c), source: 'index' }
  }
  yield* bookClueCandidates(view)
}

function fallbackClue(view, validate, player) {
  for (const candidate of fallbackClueCandidates(view)) {
    const targets = [...new Set(candidate.targetWordIds)]
    const shaped = parseClue({
      clue: candidate.clue,
      number: targets.length,
      targetWordIds: targets,
      rationale: fallbackRationale(view, targets, candidate.riskiest, player),
    })
    if (!shaped.value) continue
    const checked = validate(shaped.value)
    if (checked.value) return { value: checked.value, source: candidate.source }
  }
  return null
}

/**
 * Where a clue Casey gave came from, for the ledger: a bank group for this
 * board, an index candidate, or his own. The owner reads it in Settings to
 * see whether the first-choice groups are being played.
 */
function clueSource(view, clue) {
  const key = normalize(clue)
  const authored = authoredClueCandidates(view)
  if (authored.some((c) => normalize(c.clue) === key || (c.clueEnglish && normalize(c.clueEnglish) === key))) return 'bank'
  if (clueAssociationCandidates(view).some((c) => normalize(c.clue) === key)) return 'index'
  return 'own'
}

function fallbackGuesses(view, guessable, capacity, player) {
  const lookup = guessAssociationLookup(view)
  if (!lookup?.matched) return null
  const ids = lookup.wordIds.filter((id) => guessable.has(id)).slice(0, capacity)
  if (ids.length === 0) return null
  return ids.map((id, i) => ({
    wordId: id,
    confidence: Math.max(0.2, 0.9 - i * 0.15),
    reasoning: player.makesMeThinkOf(view.currentClue.text, nameOf(view, id), i === 0),
  }))
}

async function clueDecision(request, askModel, arm) {
  const view = request.view
  const player = playerLanguageFor(request.playerLanguage)
  const targetable = new Set(aiTargetableIds(view))
  if (targetable.size === 0) {
    throw new CaseyServiceError('invalid_state', player.messages.noWordsLeft, 409)
  }
  // The OPENING clue is precomputed (owner, 2026-09-17): on an authored board
  // with no clue history yet, the bank's first path step is the answer, and
  // the round opens with it — no model call, no thinking, not even the
  // genuine round trip to a model. The bank's groups are pre-verified, but
  // legality is still checked once here for defence; if it somehow fails,
  // fall through to the ordinary model path rather than throwing. The
  // evaluator's THETA margin is deliberately NOT applied to the opening: the
  // bank is the owner's first choice by standing decision, the opening is
  // decided before the round starts, and the evaluator advises from the
  // second clue onward. The ledger arm says `authored` and the clue-source
  // reads `bank`, so no round credits a model with a call it did not make.
  const authoredOpening = authoredFirstClue(view)
  if (authoredOpening) {
    const targets = [...new Set(authoredOpening.targetWordIds)]
    const legality = languageFor(request.language).checkClueLegality(
      authoredOpening.clue,
      view.words
        .filter((word) => word.reveal?.kind !== 'green')
        .map((word) => ({ da: word.da, en: word.en, pos: word.pos })),
    )
    if (legality.legal && targets.every((id) => targetable.has(id))) {
      return {
        value: {
          clue: authoredOpening.clue,
          number: targets.length,
          targetWordIds: targets,
          rationale: firstClueRationale(view, authoredOpening, player),
        },
        attempts: 0,
        arm: 'authored',
      }
    }
    console.warn(`casey: the bank's first clue failed its legality check (${legality.reason}); falling through to the model`)
  }
  // This is deliberately a fact about the visible decision surface, rather
  // than a guess about whether two remaining words share an association. The
  // latter would require an evaluator for every city and would silently make
  // ordinary model play depend on its coverage. When exactly one of Casey's
  // greens remains, a two-target clue is impossible; every other one-target
  // answer gets one of askValidated's finite corrective attempts instead.
  const singleTargetIsUnavoidable = targetable.size === 1
  const board = view.words
    .filter((word) => word.reveal?.kind !== 'green')
    .map((word) => ({ da: word.da, en: word.en, pos: word.pos }))
  // Two advisory sections, the authored one first: it is about this exact
  // board and Casey's exact key, where the index is about the corpus.
  const advice = [buildAuthoredClueContext(view), buildClueAssociationContext(view)]
    .filter(Boolean)
    .join('\n\n')
  const validate = (clue) => {
      const legality = languageFor(request.language).checkClueLegality(clue.clue, board)
      if (!legality.legal) return { problem: `illegal clue: ${legality.reason}` }
      const targets = [...new Set(clue.targetWordIds)]
      const notMine = targets.filter((id) => !targetable.has(id))
      if (notMine.length > 0) {
        const name = (id) => {
          const word = view.words.find((candidate) => candidate.id === id)
          return word ? `${id} (${word.da})` : id
        }
        return {
          problem:
            `${notMine.map(name).join(', ')} ${notMine.length === 1 ? 'is' : 'are'} not an unrevealed GREEN word on your key. ` +
            `Choose a clue for the words you actually hold. You may target: ${[...targetable].map(name).join(', ')}`,
        }
      }
      if (targets.length > 4) return { problem: 'at most 4 targets — give a clue for a smaller set' }
      if (targets.length === 1 && !singleTargetIsUnavoidable) {
        return {
          problem:
            'a one-target clue is only allowed when exactly one unrevealed GREEN word remains. At least two remain, so choose two or more targets that your clue genuinely reaches',
        }
      }
      const evaluatorVerdict = evaluatorProblem(view, clue.clue, targets)
      if (evaluatorVerdict) return { problem: evaluatorVerdict }
      // The player reads the rationale. The private advice stays private.
      const leaked = privateAdviceMentioned(clue.rationale)
      if (leaked) return { problem: playerVoiceProblem('rationale', leaked) }
      return { value: { ...clue, rationale: withoutDashes(clue.rationale), targetWordIds: targets, number: targets.length } }
  }
  let result
  try {
    result = await askValidated(
      askModel,
      buildCluePrompt(view, languageFor(request.language), advice, player),
      parseClue,
      validate,
      0.6,
      player.messages.noClue,
    )
  } catch (error) {
    if (!fallsBack(error)) throw error
    const fallback = fallbackClue(view, validate, player)
    if (!fallback) throw error
    console.warn(`casey: the model gave no usable clue (${error.code}); giving the ${fallback.source} clue instead`)
    return { value: fallback.value, attempts: MAX_CORRECTIONS + 1, arm: `${arm}+fallback-${fallback.source}` }
  }
  return { ...result, arm: `${arm}+${clueSource(view, result.value.clue)}` }
}

async function guessDecision(request, askModel, arm) {
  const topTwo = request.candidateMode === 'top-two'
  const player = playerLanguageFor(request.playerLanguage)
  // A clue this authored board was made for is answered from the player's
  // key, with certainty and without a model (authored-player-clues.js). The
  // arm says so in the ledger, so a round's report never credits the model
  // with a guess it did not make.
  const authored = authoredPlayerGuesses(request.view)
  if (authored) {
    return {
      // This is already the complete finite guaranteed-green plan, capped by
      // the original clue number in authoredPlayerGuesses. Do not reinterpret
      // it as uncertain alternatives for one guess.
      value: { guesses: authored },
      attempts: 0,
      arm: 'authored',
    }
  }
  const guessable = new Set(aiGuessableIds(request.view))
  const legalInModelOrder = (guesses) => {
    if (!topTwo) return guesses.filter((guess) => guessable.has(guess.wordId))
    const seen = new Set()
    return guesses.filter((guess) => {
      if (!guessable.has(guess.wordId) || seen.has(guess.wordId)) return false
      seen.add(guess.wordId)
      return true
    }).slice(0, 2)
  }
  try {
    return await askValidated(
      askModel,
      buildGuessPrompt(
        request.view,
        languageFor(request.language),
        buildGuessAssociationContext(request.view),
        request.candidateMode,
        player,
      ),
      parseGuesses,
      (answer) => {
        const guesses = legalInModelOrder(answer.guesses)
        if (guesses.length === 0) return { problem: 'every wordId was revealed or unknown' }
        // The player reads every reasoning in the reveal beat and the summary.
        for (const guess of guesses) {
          const leaked = privateAdviceMentioned(guess.reasoning)
          if (leaked) return { problem: playerVoiceProblem('reasoning', leaked) }
        }
        return { value: { guesses: guesses.map((g) => ({ ...g, reasoning: withoutDashes(g.reasoning) })) } }
      },
      0.3,
      player.messages.noGuess,
    )
  } catch (error) {
    if (!fallsBack(error)) throw error
    // Capacity is chosen before truncation. In assisted mode a clue of one can
    // therefore still rescue its first indexed choice with a second candidate.
    const capacity = topTwo ? 2 : Math.max(1, request.view.currentClue.number)
    const fallback = fallbackGuesses(request.view, guessable, capacity, player)
    const guesses = fallback ? legalInModelOrder(fallback) : null
    if (!guesses) throw error
    console.warn(`casey: the model gave no usable guess (${error.code}); guessing from the index instead`)
    return { value: { guesses }, attempts: MAX_CORRECTIONS + 1, arm: `${arm}+fallback-index` }
  }
}

/** One schema check, with no corrective conversation for the dictionary alias. */
async function translationAttempt(askModel, messages, options, language) {
  let content
  try {
    content = await askModel(messages, options)
  } catch (error) {
    // A malformed OpenAI envelope is still a malformed dictionary reply, so normal
    // Casey gets its one chance. Provider failures remain provider failures and
    // take the existing offline/server error path instead of hiding an outage.
    if (error instanceof CaseyServiceError && error.code === 'invalid_model_reply') return null
    throw error
  }
  try {
    const shaped = parseTranslation(jsonFromModel(content), language)
    return shaped.value ?? null
  } catch {
    return null
  }
}

async function translationDecision(request, askModel) {
  const player = playerLanguageFor(request.playerLanguage)
  const messages = buildTranslatePrompt(request.term, languageFor(request.language), player)
  const dictionary = await translationAttempt(askModel, messages, {
    alias: 'casey-dictionary',
    temperature: 0.1,
    maxTokens: 160,
    // gpt-oss supports low, medium and high reasoning. A one-word translation
    // uses its lowest supported level.
    reasoningEffort: 'low',
    // Tools are opt-in on Ollama. Keep the empty list explicit so a dictionary
    // lookup cannot become a search request through a provider-side default.
    disableSearch: true,
    retryOn5xx: false,
  }, request.language)
  if (dictionary) return { value: dictionary, attempts: 0 }

  // Invalid dictionary output, not an upstream failure, gets exactly one clean
  // normal-Casey attempt. It deliberately starts a new prompt: the malformed
  // content is neither useful context nor client-visible.
  const normal = await translationAttempt(askModel, messages, {
    temperature: 0.1,
    retryOn5xx: false,
  }, request.language)
  if (normal) return { value: normal, attempts: 1 }
  throw new CaseyServiceError('invalid_model_reply', player.messages.badTranslation, 502)
}

/**
 * Execute one logical Casey call. `askModel` is supplied by worker.js so only
 * that boundary can resolve aliases, attach secrets, meter attempts, or reach
 * an upstream model.
 */
export async function decide(request, askModel, arm = 'cluey') {
  if (request.operation === 'ping') {
    const result = await askValidated(
      askModel,
      [{ role: 'user', content: 'Reply with exactly this JSON object: {"ok": true}' }],
      (value) => (plainObject(value) && value.ok === true ? { value: { ok: true } } : { problem: 'ok must be true' }),
      (answer) => ({ value: answer }),
      0,
      playerLanguageFor(request.playerLanguage).messages.badPing,
    )
    return { protocol: CASEY_PROTOCOL, decision: result.value, report: { arm, refused: result.attempts > 0 } }
  }
  const result =
    request.operation === 'clue'
      ? await clueDecision(request, askModel, arm)
      : request.operation === 'guess'
        ? await guessDecision(request, askModel, arm)
        : await translationDecision(request, askModel)
  return {
    protocol: CASEY_PROTOCOL,
    decision: result.value,
    report: { arm: result.arm ?? arm, refused: result.attempts > 0 },
  }
}

/** Legacy clients omit language and continue in Danish. The caller selects
 * only a supported code; all rules and prompts remain owned by the Worker. */
export function parseDecisionRequest(value) {
  const parsed = parseLanguageDecisionRequest(value)
  const language = value.language === undefined ? 'da' : value.language
  if (!languageFor(language)) fail('request.language is unsupported')
  if (parsed.view) {
    for (const word of parsed.view.words) {
      if (language === 'de' ? !word.id.startsWith('de:') : word.id.startsWith('de:')) {
        fail('request.language does not match the board words')
      }
    }
  }
  return language === 'da' ? parsed : { ...parsed, language }
}
