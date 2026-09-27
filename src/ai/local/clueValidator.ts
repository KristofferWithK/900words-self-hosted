import { engineTrapIds, evaluatorForBoard, type Evaluator } from './evaluator'
import { THETA } from './search'
import type { AiClueView } from '../projections'

/**
 * Research-only E5a reference adapter. Production Casey runs the equivalent
 * check inside `proxy/casey/orchestrator.js`; no app path imports this module
 * or downloads an evaluator shard.
 */
export async function evaluatorClueChecker(
  view: AiClueView,
): Promise<(clue: string, targets: readonly string[]) => string | null> {
  const ev = await evaluatorForBoard(view)
  return (clue, targets) => evaluatorProblem(ev, view, clue, targets)
}

/** See the Stage 5 correction in docs/clue-engine.md. */
function evaluatorProblem(
  ev: Evaluator | null,
  view: AiClueView,
  clue: string,
  targets: readonly string[],
): string | null {
  if (!ev) return null
  const traps = engineTrapIds(view)
  // Daily and other mixed boards may straddle cities. A city evaluator saying
  // nothing about one of their live traps is not a verdict, so do not invent
  // one. Untargeted greens are intentionally absent: under Casey's clue they
  // score, rather than ending the turn, and are not traps.
  if (![...targets, ...traps].every((id) => ev.has(id))) return null

  const score = ev.scoreClue(clue, targets, traps)
  if (score.margin >= THETA) return null

  const weakTarget = targets
    .map((id) => ({ id, sim: ev.sim(clue, id) }))
    .sort((a, b) => a.sim - b.sim || (a.id < b.id ? -1 : 1))[0]!
  const targetName = view.words.find((w) => w.id === weakTarget.id)?.da ?? weakTarget.id
  if (score.riskiest) {
    const neutralName = view.words.find((w) => w.id === score.riskiest!.id)?.da ?? score.riskiest.id
    const why = ev.whyFor(clue, score.riskiest.id)
    return (
      `evaluator check: “${clue}” pulls neutral ${neutralName}${why ? ` (${why})` : ''} ` +
      `(${score.riskiest.sim}) as much as target ${targetName} (${weakTarget.sim}). ` +
      `Choose a clue that reaches ${targetName} more clearly.`
    )
  }
  return (
    `evaluator check: “${clue}” reaches target ${targetName} only ${weakTarget.sim}; ` +
    `the safety bar is ${THETA}. Choose a clearer clue for that word.`
  )
}
