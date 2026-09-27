/**
 * Derive Casey's private LCSI strength file from the canonical City 1 index.
 *
 *   node scripts/generate-lcsi-index.mjs --from <path/to/derived/merged-index.json>
 *   node scripts/generate-lcsi-index.mjs --check            (no source needed)
 *   node scripts/generate-lcsi-index.mjs --check --from …   (also proves the bytes)
 *
 * The canonical LCSI-v4 index (PR #181; 27,742 clue → word relationships, every
 * one scored on the 0–100 ruler by gpt-5.6-sol) is 88 MB and lives as a tarball
 * on the research branch `city1-canonical-index-20260902T103810Z`, never
 * merged. Casey had never seen it: nothing on main derived anything from it,
 * and the association index he reads is the UNSCORED edge list the same corpus
 * produced. The owner (2026-09-06): "We did an LCSI ranking for the entire
 * clues that are part of triples … Do you not have access to this
 * information?" This script is the access.
 *
 * What it writes — proxy/data/lcsi.da.1.json — is compact: the association
 * index's own word roster (so a word is an index into the same list), and per
 * clue a list of [wordIndex, score, uncertaintyClass]. 359 KB, 79 KB gzipped.
 * Every scored relationship is an edge of the association index (measured:
 * 3,871 of its 7,595 clues were indexed, and 27,742 of the 41,705 edges those
 * clues carry were judged, 837 clues completely), so the two files describe
 * one graph, this one with strengths on part of it.
 *
 * Provenance: the merged index's SHA-256 and row count are recorded, and
 * `--check` re-derives from `--from` when given, or otherwise verifies that
 * the committed file is internally consistent and matches the association
 * index's roster. The source cannot be on main, so the byte check needs the
 * tarball extracted locally:
 *
 *   git fetch origin city1-canonical-index-20260902T103810Z
 *   git show FETCH_HEAD:city1-canonical-index-20260902T103810Z.tar.gz > /tmp/lcsi.tgz
 *   tar xzf /tmp/lcsi.tgz -C /tmp
 *   node scripts/generate-lcsi-index.mjs --check --from /tmp/derived/merged-index.json
 *
 * An LCSI score is a rank on a fixed ruler, not a reading and not a
 * probability (docs/lcsi-judge-independence.md). The file carries the ladder
 * and the anchor names so the prompt can say what a number means.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ASSOCIATION_INDEX = 'proxy/data/association-index.da.1.json'
const OUT = 'proxy/data/lcsi.da.1.json'
const SOURCE_BRANCH = 'city1-canonical-index-20260902T103810Z'

/** The LCSI-v4 ladder: every score in the canonical index is one of these. */
export const LCSI_LADDER = Object.freeze([5, 10, 15, 20, 26.7, 33.3, 40, 46.7, 53.3, 60, 66.7, 73.3, 80, 85, 90, 95])
export const LCSI_UNCERTAINTY = Object.freeze(['reliable', 'overlap', 'sparse'])
/** The active anchors, one per coordinate, so a reader can place a number. */
export const LCSI_ANCHORS = Object.freeze({
  10: 'tæppe → ur',
  30: 'station → butik',
  50: 'by → hus',
  70: 'musik → danse',
  90: 'sko → fod',
})

const normalize = (value) => value.normalize('NFC').trim().toLowerCase()

export function deriveLcsiIndex(mergedBytes, associationIndex) {
  const merged = JSON.parse(mergedBytes.toString('utf8'))
  const rows = merged.relationships
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('merged index has no relationships')
  const wordIds = associationIndex.wordIds
  const wordIndex = new Map(wordIds.map((id, i) => [id, i]))
  const ladder = new Set(LCSI_LADDER)
  const byClue = new Map()
  const seen = new Set()
  const byUncertainty = { reliable: 0, overlap: 0, sparse: 0 }
  let model = null
  let anchorBank = null
  for (const row of rows) {
    const c = row.canonical
    if (!c || typeof c.score !== 'number') throw new Error(`${row.stableRelationshipId} carries no score`)
    if (!ladder.has(c.score)) throw new Error(`${row.stableRelationshipId} scores ${c.score}, which is not on the ladder`)
    const u = LCSI_UNCERTAINTY.indexOf(c.uncertaintyClass)
    if (u < 0) throw new Error(`${row.stableRelationshipId} has uncertainty class ${c.uncertaintyClass}`)
    if (!wordIndex.has(row.targetWordId)) throw new Error(`${row.stableRelationshipId} targets ${row.targetWordId}, off the roster`)
    const key = `${normalize(row.clue)}|${row.targetWordId}`
    if (seen.has(key)) throw new Error(`duplicate relationship ${key}`)
    seen.add(key)
    model ??= c.model
    anchorBank ??= c.anchorBank
    if (c.model !== model || c.anchorBank !== anchorBank) throw new Error('the index mixes judges or anchor banks')
    byUncertainty[c.uncertaintyClass] += 1
    const clue = row.clue.normalize('NFC').trim()
    if (!byClue.has(clue)) byClue.set(clue, [])
    byClue.get(clue).push([wordIndex.get(row.targetWordId), c.score, u])
  }
  const clues = [...byClue.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([clue, entries]) => [clue, entries.sort((a, b) => a[0] - b[0])])
  return {
    protocol: 1,
    lang: 'da',
    scope: associationIndex.scope,
    ruler: 'lcsi-v4',
    model,
    anchorBank,
    ladder: [...LCSI_LADDER],
    anchors: { ...LCSI_ANCHORS },
    uncertainty: [...LCSI_UNCERTAINTY],
    source: {
      branch: SOURCE_BRANCH,
      experimentId: merged.experimentId,
      generatedAt: merged.generatedAt,
      mergedIndexSha256: createHash('sha256').update(mergedBytes).digest('hex'),
      rows: rows.length,
      associationIndexSha256: associationIndex.source?.sha256,
    },
    metrics: {
      wordCount: wordIds.length,
      clueCount: clues.length,
      rowCount: rows.length,
      byUncertainty,
    },
    wordIds: [...wordIds],
    clues,
  }
}

/** Internal consistency of a committed file, and its roster against the association index. */
export function checkLcsiIndex(doc, associationIndex) {
  const problems = []
  if (doc?.protocol !== 1 || doc.ruler !== 'lcsi-v4') problems.push('protocol or ruler')
  if (doc.scope !== associationIndex.scope) problems.push('scope differs from the association index')
  if (JSON.stringify(doc.wordIds) !== JSON.stringify(associationIndex.wordIds)) problems.push('roster differs from the association index')
  if (JSON.stringify(doc.ladder) !== JSON.stringify(LCSI_LADDER)) problems.push('ladder')
  const ladder = new Set(LCSI_LADDER)
  let rows = 0
  const byUncertainty = { reliable: 0, overlap: 0, sparse: 0 }
  const clues = new Set()
  for (const [clue, entries] of doc.clues ?? []) {
    if (clues.has(normalize(clue))) problems.push(`clue repeated: ${clue}`)
    clues.add(normalize(clue))
    for (const [w, score, u] of entries) {
      rows += 1
      if (!Number.isInteger(w) || w < 0 || w >= doc.wordIds.length) problems.push(`word index ${w} off the roster`)
      if (!ladder.has(score)) problems.push(`score ${score} off the ladder`)
      if (!Number.isInteger(u) || u < 0 || u > 2) problems.push(`uncertainty ${u}`)
      else byUncertainty[LCSI_UNCERTAINTY[u]] += 1
    }
  }
  if (rows !== doc.metrics?.rowCount || rows !== doc.source?.rows) problems.push('row count does not match its metrics')
  if (clues.size !== doc.metrics?.clueCount) problems.push('clue count does not match its metrics')
  if (JSON.stringify(byUncertainty) !== JSON.stringify(doc.metrics?.byUncertainty)) problems.push('uncertainty counts')
  if (doc.source?.associationIndexSha256 !== associationIndex.source?.sha256) problems.push('association index provenance moved')
  return problems
}

export const renderLcsiIndex = (doc) => `${JSON.stringify(doc)}\n`

const isMain = process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname
if (isMain) {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const fromAt = args.indexOf('--from')
  const from = fromAt >= 0 ? args[fromAt + 1] : null
  const associationIndex = JSON.parse(readFileSync(resolve(ASSOCIATION_INDEX), 'utf8'))
  if (check) {
    const current = readFileSync(resolve(OUT), 'utf8')
    const problems = checkLcsiIndex(JSON.parse(current), associationIndex)
    if (from) {
      const derived = renderLcsiIndex(deriveLcsiIndex(readFileSync(resolve(from)), associationIndex))
      if (derived !== current) problems.push(`${OUT} differs from what ${from} derives`)
    }
    if (problems.length) {
      console.error(`${OUT} is stale or inconsistent:\n- ${problems.join('\n- ')}`)
      process.exit(1)
    }
    console.log(`${OUT} is current${from ? ' and matches its source' : ''}`)
  } else {
    if (!from) throw new Error('--from <merged-index.json> is required to write the file')
    const doc = deriveLcsiIndex(readFileSync(resolve(from)), associationIndex)
    writeFileSync(resolve(OUT), renderLcsiIndex(doc), 'utf8')
    console.log(`wrote ${OUT}: ${doc.metrics.clueCount} clues, ${doc.metrics.rowCount} scored relationships`)
  }
}
