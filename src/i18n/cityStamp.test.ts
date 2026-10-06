/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOGUES } from '.'

const ALL = Object.keys(CATALOGUES) as (keyof typeof CATALOGUES)[]

/**
 * Since the café world there is no city MEDAL a player can see or hear: the
 * café stamps add up to the city's stamp (owner, 2026-10-04: "since we now
 * have stamps, it's not really a medal, it's more the city stamp that you can
 * keep pushing"). Code identifiers may still say medal (`cityMedal`,
 * `MEDAL_LEVELS`); the words a player meets may not, in any catalogue.
 *
 * Read from the catalogue sources with comments and the key names taken out,
 * so a template's literal text is checked as well as plain strings.
 */
const ROOT = __dirname
const MEDAL = /medal|medaill|médaille|medalj|medalh|medall|érem|érmé|奖牌/i

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : []
  })
}

/** The source with comments and the medal-named keys removed: what is left is code and copy. */
function copyOf(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n')
    .replace(/\bcityMedal(InProgress)?\b/g, '')
}

describe('the city stamp, not a medal', () => {
  it('no catalogue says medal to a player, in any language', () => {
    const found = sources(ROOT).flatMap((file) =>
      copyOf(readFileSync(file, 'utf8'))
        .split('\n')
        .filter((line) => MEDAL.test(line))
        .map((line) => `${relative(ROOT, file)}: ${line.trim()}`),
    )
    expect(found).toEqual([])
  })

  it('all eleven catalogues name the city stamp and explain its percentage in the intro', () => {
    for (const lang of ALL) {
      const copy = CATALOGUES[lang]
      expect(copy.home.cityMedal('X'), lang).not.toMatch(MEDAL)
      expect(copy.onboarding.homeTourStamp, lang).toMatch(/%|percent|Prozent|porcentaje|pourcentage|százalék|prosent|percentage|procent|percentagem|百分比/i)
      expect(copy.onboarding.resultTourCityPercent('Sønderborg'), lang).toContain('25')
      expect(copy.onboarding.resultTourCityPercent('Sønderborg'), lang).toContain('100')
    }
  })

  it('has no em-dash in the new lines', () => {
    for (const lang of ALL) {
      const copy = CATALOGUES[lang]
      for (const line of [copy.home.cityMedal('X'), copy.onboarding.homeTourStamp, copy.onboarding.homeTourCollection, copy.onboarding.resultTourCityPercent('Sønderborg')]) {
        expect(line, lang).not.toContain('—')
      }
    }
  })
})
