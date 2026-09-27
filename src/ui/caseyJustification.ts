import type { GameState } from '../engine/types'
import { UI } from '../i18n'

type ReasonedGuess = { reasoning?: string }
type SelectedGuess = ReasonedGuess & { wordId: string; secondChoiceWordId?: string }
export type LandedCaseyGuess = {
  readonly da: string
  readonly result: 'green' | 'bystander'
  readonly reasoning: string
  readonly secondChoice?: string
}

/** Snapshot the selected row only after its result appears in this clue. */
export function landedCaseyGuess(game: GameState, selected: SelectedGuess | null): LandedCaseyGuess | null {
  const turn = game.clueHistory.at(-1)
  const result = turn?.guesses.at(-1)
  if (!selected || turn?.by !== 'player' || result?.wordId !== selected.wordId) return null
  const word = game.words.find((w) => w.wordId === selected.wordId)
  if (!word) return null
  const alternative = selected.secondChoiceWordId !== selected.wordId
    ? game.words.find((w) => w.wordId === selected.secondChoiceWordId)
    : undefined
  const reveal = alternative && game.reveals[alternative.wordId]
  // Directional legality uses the PLAYER clue even after the phase switches.
  const legal = reveal?.kind === 'hidden' || (reveal?.kind === 'bystander' && !reveal.against.includes('player'))
  return {
    da: word.da, result: result.result, reasoning: selected.reasoning ?? '',
    ...(result.result !== 'green' && alternative && legal ? { secondChoice: alternative.da } : {}),
  }
}

/**
 * The held reveal owns its explanation, regardless of the next queued row.
 *
 * Only the fixed frames are in the catalogue: the rationale itself comes back
 * from the model and is English until Phase 4, and the assembly is unchanged.
 */
export function caseyBubble(landed: LandedCaseyGuess | null, next?: ReasonedGuess): string {
  const said = (landed ? landed.reasoning : next?.reasoning)?.trim()
  const primary = said || (next ? UI.casey.lookingAgain : UI.casey.asFarAsIDare)
  return landed?.result !== 'green' && landed?.secondChoice
    ? UI.casey.withSecondChoice(primary, landed.secondChoice)
    : primary
}
