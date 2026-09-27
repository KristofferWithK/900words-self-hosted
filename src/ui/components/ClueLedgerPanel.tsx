import { UI } from '../../i18n'
import { readLedger, useLedger } from '../../stores/ledgerStore'

/**
 * The clue ledger, in Settings (docs/clue-engine.md §6 Stage 4).
 *
 * One line per arm that has ever given Casey's clue: how many clues, how many
 * of the words it asked for the player actually found, and — for the arms that
 * can be refused — how often its first reply was thrown out by the app's own
 * validator. That last column is `r`, the number `proxy/README.md` records as
 * never measured and the whole cascade arithmetic turns on.
 *
 * Deliberately plain and deliberately dull. It is a diagnostic the owner reads
 * to decide a proxy deploy, not a score the player is meant to chase — nothing
 * here appears anywhere near a round.
 */
/** The arms that answer without asking anything, and so cannot be refused. */
const OFFLINE_ARMS = new Set(['engine', 'mock'])

export function ClueLedgerPanel() {
  const arms = useLedger((s) => s.arms)
  const clear = useLedger((s) => s.clear)
  const rows = readLedger(arms)

  if (rows.length === 0) {
    return (
      <p className="ledger-empty">{UI.game.ledgerEmpty}</p>
    )
  }

  const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(100 * x)}%`)

  return (
    <div className="clue-ledger">
      <table>
        <thead>
          <tr>
            <th>{UI.game.ledgerArmHeading}</th>
            <th>{UI.game.ledgerCluesHeading}</th>
            <th>{UI.game.ledgerFoundHeading}</th>
            <th>{UI.game.ledgerRefusedHeading}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.arm}>
              <td>{r.arm}</td>
              <td>{r.tally.clues}</td>
              <td title={UI.game.ledgerHitsTitle(r.tally.hits, r.tally.asked)}>
                {pct(r.hitsPerNumber)}
              </td>
              {/* The offline arms have no validator loop to lose, so a 0 there
                  would read as "never refused" rather than "cannot be". */}
              <td title={UI.game.ledgerRefusedTitle}>
                {OFFLINE_ARMS.has(r.arm) ? 'n/a' : pct(r.refusalRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <small>{UI.game.ledgerExplainer}</small>
      <button className="btn" onClick={clear}>
        {UI.game.ledgerClear}
      </button>
    </div>
  )
}
