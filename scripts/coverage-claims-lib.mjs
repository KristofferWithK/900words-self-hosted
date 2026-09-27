import { readFileSync } from 'node:fs'

export const round3 = (part, whole) => Number(((part / whole) * 100).toFixed(3))

const need = (condition, message, errors) => {
  if (!condition) errors.push(message)
}

export const validateCoverageClaims = (ledger) => {
  const errors = []
  need(ledger?.schemaVersion === 1, 'schemaVersion must be 1', errors)
  need(/^da-spoken-coverage-v\d+\.\d+\.\d+$/.test(ledger?.ledgerVersion ?? ''), 'ledgerVersion must be a versioned Danish spoken-coverage ID', errors)
  need(ledger?.measurementUnit === 'running word tokens matched by exact NFC-normalised word form', 'measurementUnit drifted from exact running-token coverage', errors)
  need(ledger?.normalization?.credit?.includes('no lemmatisation'), 'normalization must deny lemma credit', errors)
  need(ledger?.normalization?.credit?.includes('no lemmatisation, inflection, spelling-variant, compound or word-family credit'), 'normalization must keep every no-credit boundary', errors)

  const sources = new Map((ledger?.sources ?? []).map((source) => [source.id, source]))
  const claims = new Map()
  for (const claim of ledger?.claims ?? []) {
    need(!claims.has(claim.id), `duplicate claim ID ${claim.id}`, errors)
    claims.set(claim.id, claim)
  }

  need(sources.size === 2, 'exactly the two V1 corpus sources must be present', errors)
  need(claims.size === 9, 'ledger must contain four measurements, two derivatives and three withheld answers', errors)

  const measured = [...claims.values()].filter((claim) => claim.kind === 'measured')
  need(measured.length === 4, 'exactly four atomic V1 measurements are required', errors)
  for (const claim of measured) {
    const source = sources.get(claim.sourceId)
    need(claim.status === 'accepted', `${claim.id} must be accepted`, errors)
    need(Boolean(source), `${claim.id} references missing source ${claim.sourceId}`, errors)
    if (source) {
      need(claim.runningTokens === source.runningTokens, `${claim.id} denominator differs from ${source.id}`, errors)
    }
    need(round3(claim.coveredTokens, claim.runningTokens) === claim.coveragePercent, `${claim.id} percentage does not reproduce from its numerator and denominator`, errors)
    need(claim.coveredTokens <= claim.runningTokens, `${claim.id} covers more tokens than its denominator`, errors)
    need(claim.coveredInventoryForms <= claim.inventoryForms, `${claim.id} covers more forms than its inventory`, errors)
  }

  for (const claim of [...claims.values()].filter((entry) => entry.kind === 'range')) {
    const operands = claim.claimIds.map((id) => claims.get(id))
    need(operands.every(Boolean), `${claim.id} has a missing range operand`, errors)
    if (!operands.every(Boolean)) continue
    need(operands.every((entry) => entry.kind === 'measured' && entry.inventoryId === claim.inventoryId), `${claim.id} mixes inventory or claim kinds`, errors)
    const values = operands.map((entry) => entry.coveragePercent)
    need(Math.min(...values) === claim.minimumPercent, `${claim.id} has the wrong minimum`, errors)
    need(Math.max(...values) === claim.maximumPercent, `${claim.id} has the wrong maximum`, errors)
    const rounded = `${Math.round(claim.minimumPercent)}–${Math.round(claim.maximumPercent)}%`
    need(claim.displayPercentages.length === 1 && claim.displayPercentages[0] === rounded, `${claim.id} display range must round endpoints independently`, errors)
    need(/no pooling or averaging/i.test(claim.derivation), `${claim.id} must forbid pooling and averaging`, errors)
  }

  const countClaims = new Map([...claims.values()].filter((claim) => Number.isInteger(claim.wordCount)).map((claim) => [claim.wordCount, claim]))
  need([100, 500, 900, 1000].every((count) => countClaims.has(count)), '100/500/900/1,000 answers must all exist', errors)
  for (const count of [100, 500, 1000]) {
    const claim = countClaims.get(count)
    need(claim?.status === 'withheld', `${count}-word answer must remain withheld`, errors)
    need((claim?.displayPercentages ?? []).length === 0, `${count}-word withheld answer cannot expose a percentage`, errors)
    need(Boolean(claim?.futureMethodId), `${count}-word withheld answer needs a future method`, errors)
  }
  need(countClaims.get(900)?.status === 'accepted', '900-card answer must be accepted', errors)

  const futureMethodIds = new Set((ledger?.futureMethods ?? []).map((method) => method.id))
  for (const claim of [...claims.values()].filter((entry) => entry.status === 'withheld')) {
    need(futureMethodIds.has(claim.futureMethodId), `${claim.id} references missing future method ${claim.futureMethodId}`, errors)
  }

  const forbiddenPromise = /\b(?:understand|understands|comprehension|fluen(?:t|cy)|cefr|daily speech|make(?:s)? up)\b/i
  const copyIds = new Set()
  for (const wording of ledger?.wording ?? []) {
    need(!copyIds.has(wording.id), `duplicate wording ID ${wording.id}`, errors)
    copyIds.add(wording.id)
    const claim = claims.get(wording.claimId)
    need(Boolean(claim), `${wording.id} references missing claim ${wording.claimId}`, errors)
    need(!forbiddenPromise.test(wording.text), `${wording.id} crosses the coverage/comprehension wording boundary`, errors)
    const percentages = wording.text.match(/\d+(?:\.\d+)?(?:–\d+(?:\.\d+)?)?%/g) ?? []
    const allowed = claim?.displayPercentages ?? []
    need(percentages.length === allowed.length && percentages.every((value, index) => value === allowed[index]), `${wording.id} percentage text does not equal ${wording.claimId}`, errors)
  }

  for (const point of ledger?.chartSeries ?? []) {
    const claim = claims.get(point.claimId)
    need(claim?.kind === 'measured', `chart point ${point.claimId} must reference an atomic measurement`, errors)
    need(point.coveragePercent === claim?.coveragePercent, `chart point ${point.claimId} drifted from its claim`, errors)
  }
  need((ledger?.chartSeries ?? []).length === 4, 'chart data must expose exactly four atomic measurements', errors)

  const limitations = (ledger?.globalLimitations ?? []).join(' ')
  need(/not evidence of learner acquisition, comprehension, fluency, CEFR attainment or productive speaking ability/i.test(limitations), 'global interpretation boundary is missing', errors)
  need(/never pooled or averaged/i.test(limitations), 'cross-corpus pooling boundary is missing', errors)
  need(/252 support forms beyond the 900 cards/i.test(limitations), '900-card/support distinction is missing', errors)

  return errors
}

export const readCoverageClaims = (path) => JSON.parse(readFileSync(path, 'utf8'))
