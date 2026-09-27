import { articleLabel } from '../data/gender'
import { UI, UI_LANGUAGE } from '../i18n'
import { targetTipsFor } from '../i18n/target-tips'
import { ACTIVE } from '../lang/active'
import { WORDS } from '../data/words'
import { unlockedWords } from '../journey/progress'

/**
 * What Casey says on Home: gameplay tips and small true things about Danish,
 * plus the word of the day. Static and offline on purpose — the bubble opens
 * with the app, before any key is entered, and it must cost nothing.
 *
 * The rotation is deterministic by date so the bubble greets a new day with a
 * new line; tapping the bubble leafs onward from there.
 */

/**
 * How the game works. True in any language, so they live here.
 *
 * The tips that are ABOUT the language being learned come from its ordered
 * target-language set, worded in the selected UI language. Danish also keeps
 * its existing country and culture facts after those five language tips.
 */

/**
 * The tips a new player must not wait a fortnight of rotation for, in priority
 * order: the rule easiest to get backwards first, then how a word is
 * collected. The first sessions open the bubble on these, in order (see
 * `openingLineIndex`), before
 * they take their place at the head of the ordinary rotation.
 */
export const CRITICAL_TIPS: readonly string[] = [
  UI.casey.tipCaseyKeyCounts,
  UI.casey.tipCollectBothWays,
]

/**
 * The tip that names the language being learned takes it as an argument: the
 * name comes from the pack and every language puts it somewhere else in the
 * sentence.
 */
const RULE_TIPS: readonly string[] = [
  UI.casey.tipTapCaseyForCase,
  UI.casey.tipLastChance,
  UI.casey.tipLookUpMidRound(ACTIVE.name),
]

const localizedTargetTips = targetTipsFor(UI_LANGUAGE, ACTIVE.code)
const PACK_TIPS: readonly string[] = UI_LANGUAGE === 'en' && ACTIVE.code === 'da'
  ? ACTIVE.copy.tips
  : ACTIVE.code === 'da'
    ? [...localizedTargetTips, ...ACTIVE.copy.tips.slice(5)]
    : localizedTargetTips

/**
 * Interleaved rather than appended: a fortnight of rules before the first
 * thing about the language a player is learning would be a fortnight of rules.
 * The critical tips lead the list — that is what makes leafing during the
 * intro window walk them in priority order — and the pack's language tips
 * interleave with the rules. The pack may now outgrow RULE_TIPS (the Danish
 * pack carries a run of Denmark fun facts), so instead of dropping that tail
 * it appends after the interleaved pairs: every rule still alternates with a
 * language line for as long as the pack has one to pair against, and the
 * remainder follows whole. cluey-tips.test.ts pins that nothing is dropped.
 */
const TIPS: readonly string[] = [
  ...CRITICAL_TIPS,
  ...RULE_TIPS.flatMap((tip, i) =>
    i < PACK_TIPS.length ? [tip, PACK_TIPS[i]!] : [tip],
  ),
  ...PACK_TIPS.slice(RULE_TIPS.length),
]

/** Deterministic day number, local time — the same all day, new tomorrow. */
function dayKey(): number {
  const now = new Date()
  return now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
}

/**
 * Deterministic pick that changes daily — drawn from words already unlocked.
 *
 * Undefined when the pack has no words at all. That is not a defensive
 * `?? undefined`: a preview pack ships its route and its Guide with an empty
 * card list (`LanguagePack.readiness`), and the `pool[n]!` this replaced made
 * `n` NaN and handed `articleLabel` an undefined word, which is a blank screen
 * rather than a missing bubble line.
 */
export function wordOfTheDay(cityIndex: number) {
  // A display pool, not a board pool: E0 kept "everything reached" here on
  // purpose (docs/clue-engine.md §5) even though ordinary boards went
  // city-only, since the word of the day is meant to range over all of it.
  const pool = unlockedWords(WORDS, cityIndex)
  if (pool.length === 0) return undefined
  return pool[(dayKey() * 2654435761) % pool.length]!
}

/** Everything Casey can say today, word of the day first when there is one. */
export function clueyLines(cityIndex: number): string[] {
  const w = wordOfTheDay(cityIndex)
  if (!w) return [...TIPS]
  const article = articleLabel(w) ? `${articleLabel(w)} ` : ''
  // The label is chrome and the word is content: "Word of the day: et hus —
  // house." The frame is in the catalogue; the Danish word and its meaning are
  // passed in, so H1's seam only has to change where the meaning comes from.
  return [UI.casey.wordOfTheDay(`${article}${w.da}`, `${w.en[0]}`), ...TIPS]
}

/** Where today's rotation starts; tapping the bubble leafs onward. */
export function dailyLineIndex(count: number): number {
  return dayKey() % count
}

/**
 * ── The intro window (O4) ───────────────────────────────────────────────────
 *
 * For the first few days a device opens the bubble on the critical tips, in
 * priority order, one per day — and only then joins the daily rotation. A day,
 * not an app-open, because the bubble's whole contract is "the same all day,
 * new tomorrow"; a per-open cursor would burn all four tips in one curious
 * evening. Deterministic and offline like the rest of this file: the state is
 * one localStorage key of its own (the HOWTO_KEY pattern — no settingsStore
 * field, no partialize trap, no migration), and anything unreadable in it
 * falls back to the rotation, ties toward veteran, the gate's own rule.
 */
const INTRO_KEY = 'cluecab-tips-intro'
const LAST_HOME_LINE_KEY = 'cluecab-home-line-last'

type ReadableWritableStorage = Pick<Storage, 'getItem' | 'setItem'>

const local = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

/**
 * Which critical tip fronts today, advancing one per distinct day; null once
 * the window has passed (or storage cannot carry it). Counts days it was
 * ASKED on rather than subtracting dayKeys — dayKey is not day arithmetic
 * across a month boundary, and a skipped day should not skip a tip.
 */
function introTipIndex(storage: ReadableWritableStorage | undefined, today: number): number | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(INTRO_KEY)
    let st: { n: number; d: number } | null = null
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as { n?: unknown }).n === 'number' &&
        typeof (parsed as { d?: unknown }).d === 'number'
      ) {
        st = parsed as { n: number; d: number }
      } else {
        return null
      }
    }
    if (!st) st = { n: 0, d: today }
    else if (st.d !== today) st = { n: Math.min(st.n + 1, CRITICAL_TIPS.length), d: today }
    const next = JSON.stringify(st)
    if (next !== raw) storage.setItem(INTRO_KEY, next)
    return st.n < CRITICAL_TIPS.length ? st.n : null
  } catch {
    return null
  }
}

/**
 * Where the bubble opens. During the intro window, today's critical tip (they
 * lead TIPS, so leafing onward walks the rest in priority order and then the
 * rotation) — that gate stays day-based, because a new player must not miss
 * the tips that matter by landing on a random one. After the window, the
 * rotation is no longer day-locked (owner, 2026-09-15: the bubble should
 * change every time the player comes Home): the caller hands in its random,
 * and each Home visit opens on a fresh line from the whole pool. `storage`,
 * `today` and `random` are injectable for tests only. Null means "past the
 * window — pick randomly".
 */
export function introLineIndex(
  count: number,
  storage: ReadableWritableStorage | undefined = local(),
  today: number = dayKey(),
): number | null {
  const n = introTipIndex(storage, today)
  // clueyLines puts the word of the day at 0; the critical tips start at 1.
  return n === null ? null : (1 + n) % count
}

/**
 * ── Weighting (owner, 2026-09-26) ───────────────────────────────────────────
 *
 * The pool is mostly Denmark fun facts — sixty-odd of them — so a uniform pick
 * left the "3 games a day, 900 words in 90 days" promise at under 2% of Home
 * visits. The owner wants it weighted above the fun facts, and wants lines
 * about the player's own play (casey-personal.ts) in the mix too. So the pick
 * is by SHARE, not by per-line weight: the momentum line takes a fixed slice
 * of visits however many facts the pack grows, the personal lines share
 * another slice between them, and everything else — word of the day, tips,
 * facts — splits the rest evenly. A kind with no line today gives its slice
 * back to the ordinary pool.
 */
export type HomeLineKind = 'ordinary' | 'momentum' | 'personal'

export const HOME_LINE_SHARE: Readonly<Record<Exclude<HomeLineKind, 'ordinary'>, number>> = {
  momentum: 0.2,
  personal: 0.3,
}

/**
 * A weighted pick over the pool, never `avoid` while there is anything else
 * to say. `kinds[i]` is line i's kind.
 */
export function weightedLineIndex(
  kinds: readonly HomeLineKind[],
  random: () => number = Math.random,
  avoid: number | null = null,
): number {
  const count = kinds.length
  if (count <= 1) return 0
  const buckets: Record<HomeLineKind, number[]> = { ordinary: [], momentum: [], personal: [] }
  kinds.forEach((kind, i) => {
    if (i !== avoid) buckets[kind].push(i)
  })
  const clamp = (r: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(r * n)))
  let roll = random()
  for (const kind of ['momentum', 'personal'] as const) {
    const share = HOME_LINE_SHARE[kind]
    if (buckets[kind].length === 0) continue
    if (roll < share) return buckets[kind][clamp(roll / share, buckets[kind].length)]!
    roll -= share
  }
  // The rest — including any slice a missing kind gave back — goes to the
  // ordinary lines; with none of those, to whatever is left.
  const rest = buckets.ordinary.length ? buckets.ordinary : [...buckets.momentum, ...buckets.personal]
  if (rest.length === 0) return avoid ?? 0
  return rest[clamp(random(), rest.length)]!
}

/** A fresh line for this visit, per the owner's rule above. */
export function homeLineIndex(
  count: number,
  storage: ReadableWritableStorage | undefined = local(),
  today: number = dayKey(),
  random: () => number = Math.random,
  /** Each line's kind, for the weighted pick. Absent, every line is equal. */
  kinds?: readonly HomeLineKind[],
): number {
  if (count <= 0) return 0
  const intro = introLineIndex(count, storage, today)
  if (intro !== null || count <= 1) return intro ?? 0
  const readPrevious = (): number | null => {
    try {
      const raw = storage?.getItem(LAST_HOME_LINE_KEY) ?? null
      const n = raw === null ? NaN : Number(raw)
      return Number.isInteger(n) && n >= 0 && n < count ? n : null
    } catch {
      return null
    }
  }
  const weighted = kinds && kinds.length === count
  const candidate = weighted
    ? weightedLineIndex(kinds, random, readPrevious())
    : Math.min(count - 1, Math.max(0, Math.floor(random() * count)))
  if (!storage || count <= 1) return candidate
  try {
    const previous = readPrevious()
    const index = !weighted && previous !== null && candidate === previous
      ? (candidate + 1) % count
      : candidate
    storage.setItem(LAST_HOME_LINE_KEY, String(index))
    return index
  } catch {
    return candidate
  }
}

/**
 * Which days leave Casey silent on Home (owner, 2026-09-15: "you can be on the
 * homescreen and sometimes she doesn't have a speech bubble"). Deterministic
 * off the same day number the tips machinery uses: one day in three the
 * bubble is absent and the figure stands alone. The callers override it — the
 * setup nudge speaks through the bubble, and the intro window's critical tips
 * must be seen — so silence only ever hits a veteran Home with nothing to
 * prompt. Injectable for tests.
 */
export function silentDay(today: number = dayKey()): boolean {
  return today % 3 === 0
}
