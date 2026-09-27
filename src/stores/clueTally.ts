/**
 * The favourite-clue tally. The owner declined a clue LEDGER shaped like
 * training data (ledgerStore.ts, associationStore.ts), and this is not one: a
 * capped count per clue word, per language, on this phone only — not in the
 * backup file, not in the settlement journal, never sent anywhere. Losing it
 * costs one line of Casey's chatter, so it is written best-effort outside the
 * settlement machinery, the `cluecab-tips-intro` pattern: one localStorage key,
 * no store, no migration; anything unreadable reads as empty.
 */
export const CLUE_TALLY_KEY = 'cluecab-casey-clues-v1'
/** Per language; the least-used clue goes first when a new one needs room. */
const CLUE_TALLY_CAP = 120
/** Longer than any single clue word; anything longer is not a word to quote. */
const CLUE_MAX_CHARS = 24

type ClueTally = Record<string, Record<string, number>>
type ReadableWritableStorage = Pick<Storage, 'getItem' | 'setItem'>

const local = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

export function normaliseClue(text: string): string | null {
  const clue = text.trim().toLocaleLowerCase()
  return clue && clue.length <= CLUE_MAX_CHARS ? clue : null
}

export function readClueTally(
  language: string,
  storage: ReadableWritableStorage | undefined = local(),
): Record<string, number> {
  try {
    const raw = storage?.getItem(CLUE_TALLY_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    const counts = (parsed as ClueTally | null)?.[language]
    if (!counts || typeof counts !== 'object') return {}
    return Object.fromEntries(
      Object.entries(counts).filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n > 0),
    )
  } catch {
    return {}
  }
}

/** Count one clue the player gave. Never throws. */
export function recordPlayerClue(
  language: string,
  text: string,
  storage: ReadableWritableStorage | undefined = local(),
): void {
  const clue = normaliseClue(text)
  if (!clue || !storage) return
  try {
    let all: ClueTally = {}
    const raw = storage.getItem(CLUE_TALLY_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) all = parsed as ClueTally
    }
    const counts = { ...readClueTally(language, storage) }
    counts[clue] = (counts[clue] ?? 0) + 1
    const entries = Object.entries(counts)
    if (entries.length > CLUE_TALLY_CAP) {
      // Drop the least-used clue that is not the one just counted.
      const [drop] = entries.filter(([c]) => c !== clue).sort((a, b) => a[1] - b[1])[0]!
      delete counts[drop]
    }
    storage.setItem(CLUE_TALLY_KEY, JSON.stringify({ ...all, [language]: counts }))
  } catch {
    // Chatter, not progress: a failed write is simply not counted.
  }
}
