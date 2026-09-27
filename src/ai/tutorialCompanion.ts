import {
  TUTORIAL_AI_CLUES,
  TUTORIAL_AI_RECOVERY_CLUE,
  type TutorialScript,
} from '../onboarding/tutorial'
import { AiError } from './client'
import { UI } from '../i18n'
import type { Companion } from './companion'
import { aiTargetableIds, type AiClueView, type AiGuessView } from './projections'
import type { ClueResponse, GuessResponse, TranslationResponse } from './schemas'

/**
 * The deterministic half of the tutorial: Casey's authored teaching clues.
 * The player writes their own clue and that guessing turn deliberately
 * bypasses this class for Casey proper at the game-store seam. It plays only
 * the fixed board `newTutorialGame` deals. After the opening, it reads Casey's
 * still-targetable cards: any remaining opening-clue targets receive that
 * concrete clue again, then a remaining shared target receives the second
 * clue. That keeps an honest early miss playable inside the tutorial's
 * deliberately generous token pool.
 *
 * The script itself lives in src/onboarding/tutorial.ts, pinned against the
 * engine by tutorial.test.ts — this class only reads it back.
 */
export class TutorialCompanion implements Companion {
  constructor(
    private readonly script: Pick<TutorialScript, 'aiClues' | 'recoveryClue'> = {
      aiClues: TUTORIAL_AI_CLUES,
      recoveryClue: TUTORIAL_AI_RECOVERY_CLUE,
    },
  ) {}

  async getClue(view: AiClueView): Promise<ClueResponse> {
    const given = view.history.filter((c) => c.by === 'ai').length
    const opening = this.script.aiClues[0]!
    const home = this.script.aiClues[1]!
    const targetable = new Set(aiTargetableIds(view))
    const drinkTargets = opening.targetWordIds.filter((id) => targetable.has(id))
    const homeTargets = home.targetWordIds.filter((id) => targetable.has(id))
    const scripted = given === 0
      ? opening
      : drinkTargets.length > 0
        ? {
            ...this.script.recoveryClue,
            number: drinkTargets.length,
            targetWordIds: drinkTargets,
          }
        : homeTargets.length > 0
          ? { ...home, number: homeTargets.length, targetWordIds: homeTargets }
          : null
    if (!scripted) {
      throw new AiError('invalid-response', 'The tutorial script has no clue left to give.')
    }
    return {
      clue: scripted.text,
      number: scripted.number,
      targetWordIds: [...scripted.targetWordIds],
      rationale: scripted.rationale,
    }
  }

  async getGuesses(view: AiGuessView): Promise<GuessResponse> {
    void view
    // A call here would mean the tutorial has silently stopped treating the
    // learner's clue as real input. Keep that regression loud.
    throw new AiError('invalid-response', 'Tutorial player clues must reach Casey.')
  }

  async translate(_term: string): Promise<TranslationResponse> {
    // Only reached for a word OUTSIDE the shipped dictionary — the dataset
    // answers the other nine hundred locally before the companion is asked,
    // which is why the tutorial's own clues never land here. Offline by
    // construction means an honest no, said kindly.
    // One short catalogue line: the Dictionary's answer slot is one line,
    // half a phone wide, and the old English sentence was cut there.
    throw new AiError('invalid-response', UI.game.dictionaryPracticeOnly)
  }

}
