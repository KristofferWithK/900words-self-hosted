import type { LanguagePack } from '../lang/types'
import { type GridConfig } from './config'
import {
  distinctGreenIds,
  generateKeys,
  keysFromGreenIds,
  type AuthoredGreenIds,
  type KeyBias,
} from './keygen'
import { checkClueLegality, type LegalityVerdict } from './legality'
import { matchesAnswer } from './packing'
import { mulberry32 } from './rng'
import type { BoardWord, Clue, GameEvent, GameState, Phase, Side } from './types'

export class IllegalEventError extends Error {}

export class IllegalClueError extends Error {
  constructor(public verdict: LegalityVerdict) {
    super(verdict.reason ?? 'illegal clue')
  }
}

export function createGame(opts: {
  config: GridConfig
  words: BoardWord[]
  seed: number
  firstGiver?: Side
  /** Steers which words become the player's recall practice. */
  bias?: KeyBias
  /**
   * Exact roles for an authored or composed board — the City 1 bank's, or the
   * wrap-up composer's; validated against the config, never shuffled.
   */
  authoredGreenIds?: AuthoredGreenIds
}): GameState {
  // Casey opens (owner, 2026-09-06: "I want that the round starts with Casey
  // giving a clue"). The round begins with a guess, so the player meets the
  // words under a clue before they have to compose a Danish one of their own.
  // This has gone back and forth once already — Casey opened for one build,
  // the player for the builds since, on the grounds that a round should not
  // start with waiting — and the owner's call after playing both is Casey.
  // The cost is the wait for his first clue; the study phase, where it is on,
  // still runs first and the reroll stays offered until the player's first
  // move (gameStore's `rerollOpen`), so nothing else was given up for it.
  const { config, words, seed, firstGiver = 'ai', bias, authoredGreenIds } = opts
  if (words.length !== config.totalWords) {
    throw new Error(`board needs ${config.totalWords} words, got ${words.length}`)
  }
  const wordIds = words.map((w) => w.wordId)
  const { playerKey, aiKey } = authoredGreenIds
    ? keysFromGreenIds(config, wordIds, authoredGreenIds)
    : generateKeys(config, wordIds, mulberry32(seed), bias)
  return {
    config,
    seed,
    words,
    reveals: Object.fromEntries(words.map((w) => [w.wordId, { kind: 'hidden' as const }])),
    playerKey,
    aiKey,
    phase: firstGiver === 'player' ? 'playerClueInput' : 'aiClueInput',
    turnsLeft: config.turnTokens,
    clueHistory: [],
  }
}

/** The side whose key the current clue is judged against. */
export function giverOf(phase: Phase): Side {
  if (phase === 'playerClueInput' || phase === 'aiGuessing') return 'player'
  if (phase === 'aiClueInput' || phase === 'playerGuessing') return 'ai'
  throw new IllegalEventError(`no clue-giver in phase ${phase}`)
}

/**
 * The wheel's segments, in board order: EVERY key word on the board, found or
 * not (owner, 2026-09-27). The wheel used to hold only the words found when
 * the challenge opened, so a round that ran out of clues with five of fifteen
 * found could still fill a five-slice wheel and never lose. Now a word the
 * round never found keeps a slice that can never turn green. The order is
 * fixed at open and the spin reads the same array.
 */
function wheelSegments(s: GameState): string[] {
  return [...new Set(s.words.map((w) => w.wordId))].filter(
    (id) => s.playerKey[id] === 'green' || s.aiKey[id] === 'green',
  )
}

/**
 * The wheel words the player can translate: the ones found on the board.
 * Reveals cannot change once the challenge is open, so this is fixed for it.
 * On a save written before 2026-09-27 every segment was found, so this is all
 * of them there.
 */
export function wheelFoundIds(s: GameState): string[] {
  return (s.wheel?.segments ?? []).filter((id) => s.reveals[id]?.kind === 'green')
}

/**
 * The segment indices that can never fill: one for each key word the round did
 * not find, placed at random from the round's own seed (a private salt), like
 * the fills. Derived rather than stored, so it needs no save migration: a save
 * from before the full-board wheel has only found words on its wheel and
 * derives none. Sorted, for the renderer and the tests.
 */
export function wheelMissedSegments(s: GameState): number[] {
  const n = s.wheel?.segments.length ?? 0
  const missing = n - wheelFoundIds(s).length
  if (missing <= 0) return []
  const order = Array.from({ length: n }, (_, i) => i)
  const draw = mulberry32(s.seed ^ 0x5eedd15c)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(draw() * (i + 1)) % (i + 1)
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order.slice(0, missing).sort((a, b) => a - b)
}

/** Persisted keys/reveals prove solving independently of the terminal spin. */
export function isSolvedBoard(s: GameState): boolean {
  const targets = distinctGreenIds({ playerKey: s.playerKey, aiKey: s.aiKey })
  return targets.length > 0 && targets.every((id) => s.reveals[id]?.kind === 'green')
}

/** Shared by ordinary solving, sudden-death solving and token exhaustion. */
function openTranslation(s: GameState): GameState {
  const segments = wheelSegments(s)
  // A round that found nothing has nothing to translate: its wheel would be
  // all grey, so it keeps the sudden-death ending it always had.
  if (!segments.some((id) => s.reveals[id]?.kind === 'green')) {
    s.phase = 'suddenDeath'
    return s
  }
  s.phase = 'translateChallenge'
  s.wheel = { segments, translated: [], filled: [], attempts: 0, landed: null, result: null, spent: null }
  return s
}

/**
 * C1-PC-1 successor to the mistake-free predicate: solve and translate the
 * entire target union in this attempt, then accept the actual full-wheel win.
 * Earlier wrong guesses and free translation retries do not demote it.
 * Reward eligibility and once-only claims belong to progression settlement.
 */
export function isSolvedAndTranslated(s: GameState): boolean {
  const wheel = s.wheel
  if (!isSolvedBoard(s) || !wheel || !wheel.segments.length) return false
  const targets = wheelSegments(s)
  return s.phase === 'finished' && s.outcome?.reason === 'wheel-win' && s.outcome.result === 'won' &&
    wheel.result === 'win' && wheel.landed !== null && wheel.filled.includes(wheel.landed) &&
    wheel.segments.length === targets.length && wheel.segments.every((id, i) => id === targets[i]) &&
    wheel.translated.length === targets.length && new Set(wheel.translated).size === targets.length &&
    targets.every((id) => wheel.translated.includes(id)) &&
    wheel.filled.length === targets.length && targets.every((_, i) => wheel.filled.includes(i))
}

/** @deprecated Compatibility for the remaining gameStore reader; use settlement tiers. */
export const isPerfectRound = isSolvedAndTranslated

/**
 * The headword test the translation grader consults, built over the pack it is
 * handed (H1's rule applied to one more call: the engine must not reach into
 * `src/data`, which knows the ACTIVE language, because the engine has to stay
 * testable against a fake one). The set is rebuilt per call — the challenge
 * grades one answer per event, and a thousand-entry set is nothing beside the
 * structuredClone every event already pays.
 */
function isHeadwordIn(lang: LanguagePack): (normalized: string) => boolean {
  const headwords = new Set(lang.words.map((w) => w.da.toLowerCase()))
  return (normalized: string) => headwords.has(normalized)
}

export function currentClue(state: GameState): Clue | undefined {
  return state.clueHistory[state.clueHistory.length - 1]
}

export function isGuessable(state: GameState, wordId: string): boolean {
  const reveal = state.reveals[wordId]
  if (!reveal) return false
  // Sudden death has no giver to judge against, so "burned for this side" does
  // not apply: a card that was neutral under one key can still be the other
  // side's green, and with no clues left that is exactly what you are hunting.
  if (state.phase === 'suddenDeath') return reveal.kind === 'hidden' || reveal.kind === 'bystander'
  if (reveal.kind === 'hidden') return true
  if (reveal.kind === 'bystander') return !reveal.against.includes(giverOf(state.phase))
  return false
}

export function remainingGreenIds(state: GameState): string[] {
  return distinctGreenIds({ playerKey: state.playerKey, aiKey: state.aiKey }).filter(
    (id) => state.reveals[id]!.kind !== 'green',
  )
}

/** Greens a side could still legitimately target with a clue of its own. */
export function targetableGreenIds(state: GameState, side: Side): string[] {
  const key = side === 'player' ? state.playerKey : state.aiKey
  return state.words
    .map((w) => w.wordId)
    .filter((id) => {
      if (key[id] !== 'green') return false
      const reveal = state.reveals[id]!
      if (reveal.kind === 'hidden') return true
      return reveal.kind === 'bystander' && !reveal.against.includes(side)
    })
}

function endTurn(s: GameState, giver: Side): GameState {
  s.turnsLeft -= 1
  if (s.turnsLeft <= 0) {
    // C1-PC-1: translate found targets; zero-found retains sudden death.
    return openTranslation(s)
  } else {
    // The other side normally clues next — but a side whose greens are all
    // found has nothing to clue, so the same giver continues (Duet lets the
    // team choose clue order). Every remaining green is targetable by the
    // side that holds it, so at least one side can always clue.
    const other: Side = giver === 'player' ? 'ai' : 'player'
    const nextGiver = targetableGreenIds(s, other).length > 0 ? other : giver
    s.phase = nextGiver === 'player' ? 'playerClueInput' : 'aiClueInput'
  }
  return s
}

/**
 * `lang` is here for one branch only — SUBMIT_CLUE, which has to ask whether a
 * clue is too close to a board word, and that is a question about the language.
 * Passed in rather than imported so `src/engine` stays what CLAUDE.md says it
 * is: rules, no data.
 */
export function applyEvent(state: GameState, event: GameEvent, lang: LanguagePack): GameState {
  const s = structuredClone(state)

  switch (event.type) {
    case 'SUBMIT_CLUE': {
      const expected: Record<string, Side> = { playerClueInput: 'player', aiClueInput: 'ai' }
      if (expected[s.phase] !== event.by) {
        throw new IllegalEventError(`cannot submit ${event.by} clue in phase ${s.phase}`)
      }
      if (!Number.isInteger(event.number) || event.number < 1 || event.number > 4) {
        throw new IllegalEventError('clue number must be an integer 1-4')
      }
      const visibleWords = s.words.filter((word) => s.reveals[word.wordId]?.kind !== 'green')
      const verdict = checkClueLegality(event.text, visibleWords, lang)
      if (!verdict.legal) throw new IllegalClueError(verdict)
      s.clueHistory.push({
        by: event.by,
        text: event.text.trim(),
        number: event.number,
        targets: event.targets,
        rationale: event.rationale,
        guesses: [],
      })
      s.phase = event.by === 'player' ? 'aiGuessing' : 'playerGuessing'
      return s
    }

    case 'GUESS': {
      /**
       * Sudden death has no clue and no giver, so it is judged differently:
       * a word counts if it is green on EITHER key, and anything else loses on
       * the spot. Duet has the two players keep guessing on each other's cards
       * here, which needs a partner who can guess with no clue to go on —
       * Casey cannot, and inventing a clueless AI turn would be a worse game
       * than letting the player name the board themselves. The greens on your
       * own key are the ones you can already see, so the tension is real: what
       * is left is whatever Casey was pointing at and you never worked out.
       */
      if (s.phase === 'suddenDeath') {
        if (!isGuessable(s, event.wordId)) {
          throw new IllegalEventError(`word ${event.wordId} is not guessable`)
        }
        const isGreen =
          s.playerKey[event.wordId] === 'green' || s.aiKey[event.wordId] === 'green'
        if (isGreen) {
          s.reveals[event.wordId] = { kind: 'green' }
          if (remainingGreenIds(s).length === 0) {
            return openTranslation(s)
          }
          return s
        }
        // Show what it was, so the ending is legible rather than just over.
        // Green on neither key means bystander on both, and there is no third
        // role left to distinguish — this used to branch for a forbidden word.
        s.reveals[event.wordId] = { kind: 'bystander', against: ['player', 'ai'] }
        s.phase = 'finished'
        s.outcome = { result: 'lost', reason: 'sudden-death' }
        return s
      }

      if (s.phase !== 'aiGuessing' && s.phase !== 'playerGuessing') {
        throw new IllegalEventError(`cannot guess in phase ${s.phase}`)
      }
      if (!isGuessable(s, event.wordId)) {
        throw new IllegalEventError(`word ${event.wordId} is not guessable`)
      }
      const giver = giverOf(s.phase)
      const clue = currentClue(s)
      if (!clue) throw new IllegalEventError('no active clue')
      const key = giver === 'player' ? s.playerKey : s.aiKey
      const role = key[event.wordId]
      if (!role) throw new IllegalEventError(`unknown word ${event.wordId}`)
      clue.guesses.push({
        wordId: event.wordId,
        result: role,
        // Undefined for the player's own taps; the AI's account of its own
        // guess rides along and is kept for the summary's turn log.
        ...(event.reasoning ? { reasoning: event.reasoning } : {}),
        ...(event.confidence !== undefined ? { confidence: event.confidence } : {}),
      })

      if (role === 'green') {
        s.reveals[event.wordId] = { kind: 'green' }
        if (remainingGreenIds(s).length === 0) {
          return openTranslation(s)
        }
        /**
         * The number is the whole allowance. Guess that many right and the turn
         * ends itself.
         *
         * Codenames and Duet both grant a bonus (number + 1)-th guess, and this
         * followed them — but the bonus is there to pick up a word left over
         * from an EARLIER clue, which is a move a player has to be told about to
         * ever make. In practice it read as the turn not ending: you guessed the
         * two words Casey asked for, both green, and then nothing happened until
         * you found "Stop guessing". Asked for directly, before the rename:
         * "when you have guessed the amount of words Cluey gives you the turn
         * ends automatically."
         *
         * Stopping short is still yours to do — the button remains, and stopping
         * after one of three is a real decision. It is only the guess past the
         * number that is gone.
         */
        if (clue.guesses.length >= clue.number) return endTurn(s, giver)
        return s
      }

      // Not green on the giver's key, so it is a bystander there — the only
      // other thing a card can be. It costs the turn and nothing worse; there
      // used to be a third branch here where a forbidden word ended the round
      // outright, or opened the translate-everything last chance if enough
      // clues had been given.
      const reveal = s.reveals[event.wordId]!
      if (reveal.kind === 'bystander') {
        if (!reveal.against.includes(giver)) reveal.against.push(giver)
      } else {
        s.reveals[event.wordId] = { kind: 'bystander', against: [giver] }
      }
      return endTurn(s, giver)
    }

    case 'STOP_GUESSING': {
      // Walking away from sudden death is allowed and is a loss: it is the
      // difference between deciding you are beaten and being told you are.
      if (s.phase === 'suddenDeath') {
        s.phase = 'finished'
        s.outcome = { result: 'lost', reason: 'timeout' }
        return s
      }
      if (s.phase !== 'aiGuessing' && s.phase !== 'playerGuessing') {
        throw new IllegalEventError(`cannot stop guessing in phase ${s.phase}`)
      }
      const clue = currentClue(s)
      if (!clue || clue.guesses.length === 0) {
        throw new IllegalEventError('must make at least one guess before stopping')
      }
      return endTurn(s, giverOf(s.phase))
    }

    case 'START_TRANSLATE_CHALLENGE': {
      // The challenge opens once per round, from token exhaustion (endTurn)
      // or from the store resuming a round saved inside one. Opening it twice
      // would rebuild the wheel mid-challenge, so it refuses anything else.
      if (s.phase !== 'translateChallenge' || s.wheel) {
        throw new IllegalEventError(`cannot start the challenge in phase ${s.phase}`)
      }
      return openTranslation(s)
    }

    case 'SUBMIT_TRANSLATION': {
      if (s.phase !== 'translateChallenge') {
        throw new IllegalEventError(`cannot translate in phase ${s.phase}`)
      }
      const wheel = s.wheel
      if (!wheel || !wheel.segments.length) throw new IllegalEventError('no translation targets')
      if (!wheel.segments.includes(event.wordId)) {
        throw new IllegalEventError(`word ${event.wordId} is not on the wheel`)
      }
      // A key word the round never found holds a slice but is not a suitcase:
      // only what was put into a suitcase can be translated back.
      if (s.reveals[event.wordId]?.kind !== 'green') {
        throw new IllegalEventError(`word ${event.wordId} was not found on the board`)
      }
      if (wheel.translated.includes(event.wordId)) return s
      const word = s.words.find((w) => w.wordId === event.wordId)!
      // The packing grader, because the two phases ask the same kind of
      // answer: recall from the gloss, with the article optional, inflections
      // accepted and thumb-slips forgiven — but never a different word. The
      // owner's spec said case-insensitive; the grader is a superset of that
      // and already ships, so the challenge grades exactly like packing.
      if (!matchesAnswer(event.answer, word.da, lang, isHeadwordIn(lang))) {
        // Free retries: a miss costs the attempt counter and nothing else.
        wheel.attempts += 1
        return s
      }
      wheel.translated.push(event.wordId)
      // The owner's amendment (2026-09-16): a correct translation fills a
      // RANDOM empty segment, not the next one in board order — which word was
      // answered says nothing about where the wheel's green lands. Drawn from
      // the round's own seed stream (one mulberry32 per fill, a private salt,
      // `translated.length` as the counter — attempts can repeat across two
      // consecutive hits, which would draw the same random value twice), so
      // the renderer cannot choose the fill and a replay replays. The missed
      // words' slices are never candidates: they stay grey.
      const missed = wheelMissedSegments(s)
      const empty = wheel.segments
        .map((_, i) => i)
        .filter((i) => !wheel.filled.includes(i) && !missed.includes(i))
      const fill = mulberry32(s.seed ^ 0x5eedf111 ^ wheel.translated.length)
      const pick = empty[Math.floor(fill() * empty.length) % empty.length]!
      wheel.filled.push(pick)
      if (wheel.translated.length === wheelFoundIds(s).length) {
        // Last suitcase packed: every slice that can fill has. The phase changes by
        // itself — COMPLETE_CHALLENGE exists for a client driving the phases
        // one event at a time and is a no-op from here.
        s.phase = 'translateWheel'
      }
      return s
    }

    case 'COMPLETE_CHALLENGE': {
      // Arriving here with the phase already moved (the last SUBMIT_TRANSLATION
      // above) is the normal path; a client that tracks progress itself calls
      // this when its count says full, and the engine re-checks rather than
      // trusting it.
      if (s.phase !== 'translateChallenge') return s
      const wheel = s.wheel
      if (!wheel || !wheel.segments.length) throw new IllegalEventError('no translation targets')
      if (wheel.translated.length !== wheelFoundIds(s).length) {
        throw new IllegalEventError('challenge is not complete')
      }
      s.phase = 'translateWheel'
      return s
    }

    case 'SPIN_WHEEL': {
      // The verdict enters the returned state before any animation. The store
      // persists it; duplicate delivery after reload/remount never draws again.
      if (s.phase === 'finished' && s.wheel?.result &&
        s.outcome?.reason === (s.wheel.result === 'win' ? 'wheel-win' : 'wheel-miss')) return s
      if (s.phase !== 'translateChallenge' && s.phase !== 'translateWheel') {
        throw new IllegalEventError(`cannot spin in phase ${s.phase}`)
      }
      const wheel = s.wheel
      if (!wheel || !wheel.segments.length) throw new IllegalEventError('no translation targets')
      if (wheel.result) {
        throw new IllegalEventError('the wheel has already spun')
      }
      // Pure chance, drawn engine-side from the round's own seed stream so the
      // renderer cannot pick its prize and a replay replays. A mulberry32 per
      // spin keeps the stream independent of how many spins ever happen.
      const spin = mulberry32(s.seed ^ 0x5eed1dea ^ wheel.attempts)
      wheel.landed = Math.floor(spin() * wheel.segments.length) % wheel.segments.length
      // The verdict reads the FILLED segments, not `translated`: the owner's
      // amendment decoupled which word was answered from where the fill went,
      // so a landed segment wins because the engine filled it — not because
      // the segment's own word happened to be the one answered.
      wheel.result = wheel.filled.includes(wheel.landed) ? 'win' : 'miss'
      // THE SPIN DECIDES THE ROUND (owner, 2026-09-18): no token, no chooser —
      // the verdict maps straight onto the round's outcome through the normal
      // engine outcome path, so the finish screen's reward logic runs
      // unchanged. A green landing is a WIN with its own reason; the wheel's
      // 'win'/'miss' verdict stays in the state for the spinner's animation
      // and the summary's line.
      if (wheel.result === 'win') {
        s.phase = 'finished'
        s.outcome = { result: 'won', reason: 'wheel-win' }
        return s
      }
      s.phase = 'finished'
      s.outcome = { result: 'lost', reason: 'wheel-miss' }
      return s
    }

    case 'SPEND_WHEEL_TOKEN': {
      // The chooser is gone: the spin decides the round outright (owner,
      // 2026-09-18). The event type remains so a replayed history cannot open
      // a hole in the reducer's switch, and the refusal is total — no phase,
      // no state shape, reaches a spent token any more.
      throw new IllegalEventError(`no won token to spend in phase ${s.phase}`)
    }
  }
}
