import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * CW-08: "a café that is not found cannot be opened", on every path.
 *
 * The rule itself lives in one place: gameStore's `newGame` refuses a
 * required board no walk has found (CW-04, `cafeLaunchRefused`, while
 * `CAFE_GATE_ENABLED`), and `startReplay` only replays a board already
 * played. What a screen must add is not leaving its control dead when the
 * deal is refused: every `newGame(` a screen calls goes through
 * `dealOrFallBack` (CW-10), on the same line, so the fallback is visible
 * where the deal is. The one exception is the daily challenge, a seeded
 * board that is not a café (and has no control since 2026-09-15).
 */
const UI_ROOT = join(__dirname, '..', 'ui')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const NOT_A_CAFE = [/newGame\(\{ seed: daily\.seed, dailyKey: daily\.key/]

describe('every path into a café puzzle respects the café gate', () => {
  const calls = sources(UI_ROOT).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ file: relative(UI_ROOT, file).replace(/\\/g, '/'), line: i + 1, text: line.trim() }))
      .filter(({ text }) => /\bnewGame\(/.test(text) && !text.startsWith('//') && !text.startsWith('*')),
  )

  it('finds the screens that deal a board', () => {
    const files = new Set(calls.map((call) => call.file))
    for (const file of ['screens/HomeScreen.tsx', 'screens/MapScreen.tsx', 'introRound.ts', 'components/RoundSummary.tsx']) {
      expect(files).toContain(file)
    }
  })

  it('deals only through dealOrFallBack, except the daily challenge', () => {
    const bare = calls.filter(({ text }) => !text.includes('dealOrFallBack(') && !NOT_A_CAFE.some((rule) => rule.test(text)))
    expect(bare).toEqual([])
  })
})
