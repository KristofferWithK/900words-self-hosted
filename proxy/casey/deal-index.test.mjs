import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadEvaluator } from './evaluator.js'
import { checkClueLegality } from './language.js'

const words = new Map(
  JSON.parse(readFileSync('src/data/words.da.json', 'utf8')).map((word) => [word.id, word]),
)

describe('BQ1 precomputed score index', () => {
  it('matches the canonical evaluator across every clue form and sampled words', () => {
    for (const city of [1, 2, 9]) {
      const index = JSON.parse(readFileSync(`proxy/data/deal-index.da.${city}.json`, 'utf8'))
      const evaluator = loadEvaluator(city)
      expect(evaluator.dealSim).toBeTypeOf('function')
      for (let row = 0; row < index.forms.length; row++) {
        const form = index.forms[row]
        // A city-wide stride covers every column across consecutive rows while
        // keeping this exhaustive-form parity pin cheap enough for every run.
        const id = index.ids[(row * 37) % index.ids.length]
        expect(evaluator.dealSim(form, id), `${city}: ${form} -> ${id}`).toBe(evaluator.sim(form, id))
        expect(evaluator.dealRow(form).legalFor([id]), `${city}: legality ${form} -> ${id}`).toBe(
          checkClueLegality(form, [words.get(id)]).legal,
        )
      }
    }
  })

  it('falls back to canonical scoring for forms outside certification’s finite universe', () => {
    const evaluator = loadEvaluator(1)
    expect(evaluator.dealSim('a form that cannot be in the index', evaluator.ids[0])).toBe(
      evaluator.sim('a form that cannot be in the index', evaluator.ids[0]),
    )
  })
})
