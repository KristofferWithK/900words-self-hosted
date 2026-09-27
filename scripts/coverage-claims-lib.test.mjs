import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateCoverageClaims } from './coverage-claims-lib.mjs'

const ledgerPath = fileURLToPath(new URL('../docs/coverage-claims.v1.json', import.meta.url))
const fresh = () => JSON.parse(readFileSync(ledgerPath, 'utf8'))

describe('coverage claim ledger', () => {
  it('accepts the committed V1 claim pack', () => {
    expect(validateCoverageClaims(fresh())).toEqual([])
  })

  it('rejects a percentage that no longer matches its numerator and denominator', () => {
    const ledger = fresh()
    ledger.claims[0].coveragePercent = 80
    expect(validateCoverageClaims(ledger)).toContain(
      'DA-SPOKEN-FORM-CARDS900-DAGW-SPONT-V1 percentage does not reproduce from its numerator and denominator',
    )
  })

  it('rejects an invented smaller-prefix percentage', () => {
    const ledger = fresh()
    const claim = ledger.claims.find((entry) => entry.wordCount === 100)
    claim.displayPercentages = ['20%']
    expect(validateCoverageClaims(ledger)).toContain('100-word withheld answer cannot expose a percentage')
  })

  it('rejects copy that turns coverage into a learner promise', () => {
    const ledger = fresh()
    ledger.wording[0].text = 'Understand 77–79% of daily speech with 900 words.'
    const errors = validateCoverageClaims(ledger)
    expect(errors).toContain('COPY-IN1-CASEY-COVERAGE-V1 crosses the coverage/comprehension wording boundary')
  })

  it('rejects a pooled-looking range or wording number drift', () => {
    const ledger = fresh()
    const range = ledger.claims.find((entry) => entry.kind === 'range')
    range.displayPercentages = ['78%']
    ledger.wording[0].text = ledger.wording[0].text.replace('77–79%', '78%')
    expect(validateCoverageClaims(ledger)).toContain(
      'DA-SPOKEN-FORM-COURSE1152-RANGE-V1 display range must round endpoints independently',
    )
  })
})
