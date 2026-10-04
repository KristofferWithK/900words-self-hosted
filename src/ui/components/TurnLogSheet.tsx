import type { GameState } from '../../engine/types'
import { clueFlagId, guessFlagId, useFeedback } from '../../stores/feedbackStore'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import { useDialog } from '../useDialog'
import { Tag } from './Tag'

/** The flag stays beside the reasoning it is correcting. */
function FlagButton({
  id,
  kind,
  what,
  underClue,
  why,
  label,
}: {
  id: string
  kind: 'clue' | 'guess'
  what: string
  underClue?: string
  why?: string
  label: string
}) {
  const flags = useFeedback((s) => s.flags)
  const toggleFlag = useFeedback((s) => s.toggleFlag)
  const flagged = flags.some((f) => f.id === id)
  return (
    <button
      className={`flag-btn ${flagged ? 'flag-on' : ''}`}
      aria-pressed={flagged}
      aria-label={flagged ? UI.game.flagOnAria(label) : UI.game.flagOffAria(label)}
      onClick={() => toggleFlag({ id, kind, what, underClue, why })}
    >
      ⚑
    </button>
  )
}

/**
 * Casey's calls are a review detail, not another band on P1's fixed summary.
 * The sheet is deliberately fixed and owns its only overflow, using the same
 * modal idiom as DictionarySheet.
 */
export function TurnLogSheet({ game, onClose }: { game: GameState; onClose: () => void }) {
  const dialogRef = useDialog(true, onClose)
  const da = (id: string) => game.words.find((w) => w.wordId === id)?.da ?? id

  return (
    <div className="sheet-backdrop turn-log-backdrop" onClick={onClose}>
      <div
        className="sheet turn-log-sheet"
        id="turn-log-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="turn-log-sheet-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head turn-log-head">
          <h2 id="turn-log-sheet-title">{UI.game.caseysCalls}</h2>
          <span className="pos-badge">{UI.game.turnCount(game.clueHistory.length)}</span>
        </div>
        <p className="dim log-hint">{UI.game.logHint}</p>
        <ol className="turn-log" id="round-turn-log">
          {game.clueHistory.map((c, i) => {
            const clueId = clueFlagId(game.seed, i)
            return (
              <li key={i}>
                <p className="turn-clue">
                  <strong>{c.by === 'player' ? UI.game.logYou : 'Casey'}:</strong> «{c.text}» ({c.number})
                  {c.by === 'ai' && c.targets && (
                    <span className="dim">
                      {' '}
                      {UI.game.logFor} <span lang={ACTIVE.code}>{c.targets.map(da).join(', ')}</span>
                    </span>
                  )}
                  {c.by === 'ai' && (
                    <FlagButton
                      id={clueId}
                      kind="clue"
                      what={c.text}
                      why={c.rationale}
                      label={UI.game.flagClueLabel(c.text)}
                    />
                  )}
                </p>
                {c.rationale && <p className="turn-why">{c.rationale}</p>}
                <ul className="turn-guesses">
                  {c.guesses.map((g, gi) => (
                    <li key={gi} className={`guess-${g.result}`}>
                      <span className="result-mark" aria-hidden="true">
                        {g.result === 'green' ? '✓' : '·'}
                      </span>
                      <span lang={ACTIVE.code} className="guess-word">
                        {da(g.wordId)}
                      </span>
                      <span className="visually-hidden">
                        {g.result === 'green' ? UI.game.guessCorrectSr : UI.game.guessNeutralSr}
                      </span>
                      {g.reasoning && <span className="turn-why guess-why">{g.reasoning}</span>}
                      {g.confidence !== undefined && (
                        <span className="guess-confidence">
                          {UI.game.confidenceSure(Math.round(g.confidence * 100))}
                        </span>
                      )}
                      {/* Casey's guesses are the ones made under the player's clue. */}
                      {c.by === 'player' && (
                        <FlagButton
                          id={guessFlagId(game.seed, i, gi)}
                          kind="guess"
                          what={da(g.wordId)}
                          underClue={c.text}
                          why={g.reasoning}
                          label={UI.game.flagGuessLabel(da(g.wordId))}
                        />
                      )}
                    </li>
                  ))}
                  {c.guesses.length === 0 && <li className="dim">{UI.game.noGuessMade}</li>}
                </ul>
              </li>
            )
          })}
        </ol>
        <Tag size="wide" className="log-close" label={UI.game.close} onClick={onClose} />
      </div>
    </div>
  )
}
