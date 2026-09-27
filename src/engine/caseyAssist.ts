import { isGuessable } from './game'
import type { GameState } from './types'

export interface CaseyCandidate {
  wordId: string
}

export interface CaseyChoice<T extends CaseyCandidate> {
  /** Other legal candidate from this decision, never a later planned guess. */
  secondChoiceWordId?: string
  choice: T
  /** What unassisted play would have named from these same ranked candidates. */
  unassistedWordId: string
  /** True only when the second-ranked candidate turns a first-ranked miss into a hit. */
  rescued: boolean
}

/**
 * Keep model rank while removing candidates that cannot legally be named in
 * the current player-clue state. Invalid rows are never replaced from a key.
 */
export function legalCaseyCandidates<T extends CaseyCandidate>(
  state: GameState,
  candidates: readonly T[],
): T[] {
  const seen = new Set<string>()
  const legal: T[] = []
  for (const candidate of candidates) {
    if (seen.has(candidate.wordId) || !isGuessable(state, candidate.wordId)) continue
    seen.add(candidate.wordId)
    legal.push(candidate)
    if (legal.length === 2) break
  }
  return legal
}

/** Resolve one actual Casey guess from the model's first two legal choices. */
export function chooseCaseyGuess<T extends CaseyCandidate>(
  state: GameState,
  candidates: readonly T[],
  assisted: boolean,
): CaseyChoice<T> | null {
  const [first, second] = legalCaseyCandidates(state, candidates)
  if (!first) return null

  const firstIsGreen = state.playerKey[first.wordId] === 'green'
  const secondIsGreen = second && state.playerKey[second.wordId] === 'green'
  const choice = assisted && !firstIsGreen && secondIsGreen ? second : first
  return {
    choice,
    ...(second ? { secondChoiceWordId: choice === first ? second.wordId : first.wordId } : {}),
    unassistedWordId: first.wordId,
    rescued: choice !== first,
  }
}
