import { describe, expect, it } from 'vitest'
import words from '../../src/data/words.da.json'
import associationIndex from '../data/association-index.da.1.json'
import bank from '../data/authored-clues.da.1.json'
import lcsiDoc from '../data/lcsi.da.1.json'
import { checkLcsiIndex, LCSI_LADDER as SCRIPT_LADDER } from '../../scripts/generate-lcsi-index.mjs'
import { authoredClueCandidates, buildAuthoredClueContext } from './authored-clues.js'
import {
  buildClueAssociationContext,
  buildGuessAssociationContext,
  clueAssociationCandidates,
  guessAssociationLookup,
  legalCacheSize,
} from './association-index.js'
import {
  LCSI_LADDER,
  compareBySafety,
  formatScore,
  lcsiIndexInfo,
  lcsiRulerLine,
  lcsiScore,
  lcsiScoresFor,
  localStatistics,
  rungOf,
} from './lcsi.js'

/**
 * Casey has the canonical LCSI-v4 strengths (owner, 2026-09-06: "We did an
 * LCSI ranking for the entire clues that are part of triples … Do you not
 * have access to this information?"). These pin the file's provenance and
 * shape, that it covers what Casey reads, and that the numbers reach his
 * prompt on both sides in the ruler's own terms.
 */
const byId = new Map(words.map((word) => [word.id, word]))
const board1 = bank.boards[0]

const clueViewFor = (board, { reveals = {} } = {}) => ({
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 8,
  boardId: board.id,
  words: board.wordIds.map((id) => {
    const entry = byId.get(id)
    return {
      id,
      da: entry.da,
      en: entry.en,
      pos: entry.pos,
      reveal: reveals[id] ?? { kind: 'hidden' },
      roleOnMyKey: board.aiGreenIds.includes(id) ? 'green' : 'bystander',
    }
  }),
  history: [],
  flagged: [],
})

const guessViewFor = (board, clue, number = 2) => {
  const view = clueViewFor(board)
  return {
    ...view,
    kind: 'ai-guess',
    words: view.words.map(({ roleOnMyKey, ...word }) => word),
    currentClue: { text: clue, number },
  }
}

describe('the private LCSI file', () => {
  it('is the canonical index, complete, by one judge on one anchor bank', () => {
    expect(lcsiIndexInfo()).toMatchObject({
      wordCount: 100,
      clueCount: 3871,
      rowCount: 27742,
      byUncertainty: { reliable: 21363, overlap: 6136, sparse: 243 },
      model: 'gpt-5.6-sol',
      anchorBank: 'da-lcsi-v4-active-15',
      scope: 'replacement-city1-first-100',
      // The merge verification's recorded output hash (PR #181).
      mergedIndexSha256: '117dd4ed1cf6b5b0a349d7ebc7ee0d5ef6670c6be3c4c4df1b0ab2a40077bcf9',
      associationIndexSha256: '6a6e669768db0d0ded6d73cae1d649af4db26f9c67c3dda8c7fb005debd12289',
    })
    expect(LCSI_LADDER).toEqual(SCRIPT_LADDER)
  })

  it('is internally consistent and shares the association index roster', () => {
    expect(checkLcsiIndex(lcsiDoc, associationIndex)).toEqual([])
    expect(lcsiDoc.wordIds).toEqual(associationIndex.wordIds)
  })

  it('scores only edges the association index has — 27,742 of the 41,705 its 3,871 clues carry', () => {
    const edges = new Map(associationIndex.clues.map(([clue, indices]) => [clue.normalize('NFC').trim().toLowerCase(), new Set(indices.map((i) => associationIndex.wordIds[i]))]))
    let scored = 0
    let carried = 0
    let fullyScored = 0
    for (const [clue, entries] of lcsiDoc.clues) {
      const linked = edges.get(clue.normalize('NFC').trim().toLowerCase())
      expect(linked, clue).toBeDefined()
      for (const [w] of entries) expect(linked.has(lcsiDoc.wordIds[w])).toBe(true)
      scored += entries.length
      carried += linked.size
      if (entries.length === linked.size) fullyScored += 1
    }
    expect(scored).toBe(27742)
    expect(carried).toBe(41705)
    expect(fullyScored).toBe(837)
  })

  it('covers every target of every authored Casey group', () => {
    let pairs = 0
    for (const board of bank.boards) {
      for (const group of board.caseyClueGroups) {
        for (const target of group.targetWordIds) {
          pairs += 1
          expect(lcsiScore(group.clue, target), `${board.id} ${group.clue} → ${target}`).not.toBeNull()
        }
      }
    }
    expect(pairs).toBe(3148)
  })
})

describe('reading the ruler', () => {
  it('looks a relationship up exactly, normalised, and answers null for the unknown', () => {
    expect(lcsiScore('abe', 'da:dyr')).toEqual({ score: 80, uncertainty: 'reliable' })
    expect(lcsiScore('  ABE ', 'da:dyr')?.score).toBe(80)
    expect(lcsiScore('abe', 'da:uge')).toBeNull()
    expect(lcsiScore('zzzz-not-a-clue', 'da:dyr')).toBeNull()
    expect(lcsiScoresFor('zzzz-not-a-clue')).toBeNull()
    expect(lcsiScoresFor('abe').get('da:dyr').score).toBe(80)
  })

  it('places a score on the ladder and measures margins in rungs', () => {
    expect(rungOf(5)).toBe(0)
    expect(rungOf(95)).toBe(LCSI_LADDER.length - 1)
    expect(rungOf(60) - rungOf(46.7)).toBe(2)
    expect(rungOf(61)).toBe(rungOf(60))
    expect(rungOf(null)).toBeNull()
    expect(formatScore(60)).toBe('60')
    expect(formatScore(66.7)).toBe('66.7')
  })

  it('reports floor, ceiling and margin, treating an unscored word as unknown rather than weak', () => {
    const group = board1.caseyClueGroups[0]
    const neutrals = board1.wordIds.filter((id) => !board1.aiGreenIds.includes(id))
    const stats = localStatistics(group.clue, group.targetWordIds, neutrals)
    expect(stats.targets.every((t) => t.score !== null)).toBe(true)
    expect(stats.floor).toBe(Math.min(...stats.targets.map((t) => t.score)))
    expect(stats.unscoredTargets).toBe(0)
    const scoredNeutrals = stats.neutrals.filter((n) => n.score !== null)
    if (scoredNeutrals.length === 0) {
      expect(stats.ceiling).toBeNull()
      expect(stats.margin).toBeNull()
    } else {
      expect(stats.ceiling).toBe(Math.max(...scoredNeutrals.map((n) => n.score)))
      expect(stats.margin).toBe(rungOf(stats.floor) - rungOf(stats.ceiling))
    }
    const unknown = localStatistics('zzzz-not-a-clue', group.targetWordIds, neutrals)
    expect(unknown.floor).toBeNull()
    expect(unknown.unscoredTargets).toBe(group.targetWordIds.length)
  })

  it('orders safer first: no scored pull beats any margin, wider margins beat narrower, then the floor', () => {
    const clean = { floor: 46.7, ceiling: null, margin: null }
    const wide = { floor: 60, ceiling: 20, margin: 6 }
    const narrow = { floor: 66.7, ceiling: 60, margin: 1 }
    const weakClean = { floor: 40, ceiling: null, margin: null }
    expect([narrow, wide, weakClean, clean].sort(compareBySafety)).toEqual([clean, weakClean, wide, narrow])
  })

  it('explains the ruler once, with its anchors and the margin zones', () => {
    const line = lcsiRulerLine()
    expect(line).toContain('sko → fod is 90')
    expect(line).toContain('by → hus is 50')
    expect(line).toContain('a rank, not a probability')
    expect(line).toContain('UNKNOWN to the index, never weak')
    expect(line).toContain('3 or more is strong separation')
  })
})

describe('the cost of a clue request', () => {
  it('computes a board’s legal index clues once and reuses them for the rest of the round', () => {
    const view = clueViewFor(board1)
    const before = legalCacheSize()
    const first = clueAssociationCandidates(view)
    expect(legalCacheSize()).toBe(before + 1)
    // A found green no longer restricts clues, so its visible-word set has a
    // separate legality entry; repeating that set is a cache read.
    const revealedGreenView = clueViewFor(board1, { reveals: { [board1.aiGreenIds[0]]: { kind: 'green' } } })
    const later = clueAssociationCandidates(revealedGreenView)
    expect(legalCacheSize()).toBe(before + 2)
    clueAssociationCandidates(revealedGreenView)
    expect(legalCacheSize()).toBe(before + 2)
    expect(later.length).toBeGreaterThan(0)
    expect(first.length).toBeGreaterThan(0)
    // Another board is another entry.
    clueAssociationCandidates(clueViewFor(bank.boards[1]))
    expect(legalCacheSize()).toBe(before + 3)
    const t = performance.now()
    clueAssociationCandidates(view)
    expect(performance.now() - t).toBeLessThan(200)
  })
})

describe('what reaches Casey', () => {
  it('prints a strength beside every authored target and a floor per row', () => {
    const view = clueViewFor(board1)
    const candidates = authoredClueCandidates(view)
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      expect(candidate.strength.floor).not.toBeNull()
      expect(candidate.strength.unscoredTargets).toBe(0)
    }
    const context = buildAuthoredClueContext(view)
    expect(context).toContain('Strengths are LCSI ranks')
    const rows = context.split('\n').filter((line) => line.startsWith('- “'))
    expect(rows.length).toBe(candidates.length)
    for (const row of rows) {
      expect(row).toMatch(/→ targets: .*\d/)
      expect(row).toMatch(/target floor \d/)
      expect(row).toContain('other live board pulls:')
    }
    expect(context).toMatch(/A path .*floor \d/)
  })

  it('orders authored rows of equal reach safer first', () => {
    const candidates = authoredClueCandidates(clueViewFor(board1))
    for (let i = 1; i < candidates.length; i++) {
      const a = candidates[i - 1]
      const b = candidates[i]
      if (a.targetWordIds.length !== b.targetWordIds.length) continue
      expect(compareBySafety(a.strength, b.strength)).toBeLessThanOrEqual(0)
    }
  })

  it('carries strengths on the index candidates too, where the link was judged', () => {
    const view = clueViewFor(board1)
    const candidates = clueAssociationCandidates(view)
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      expect(candidate.strength.targets.map((t) => t.id)).toEqual(candidate.targetWordIds)
    }
    const context = buildClueAssociationContext(view)
    expect(context).toContain('Strengths are LCSI ranks')
    expect(context).toMatch(/proposed targets: .*\d/)
    expect(context).toContain('other live board pulls')
  })

  it('under a player clue lists the linked words strongest first with their strengths', () => {
    const scored = lcsiDoc.clues.find(([clue, entries]) => {
      const linked = new Set(entries.map(([w]) => lcsiDoc.wordIds[w]))
      return [...linked].filter((id) => board1.wordIds.includes(id)).length >= 2 && clue === clue.trim()
    })
    expect(scored).toBeDefined()
    const view = guessViewFor(board1, scored[0])
    const lookup = guessAssociationLookup(view)
    expect(lookup.matched).toBe(true)
    const scores = lookup.strengths.map((s) => s.score)
    const known = scores.filter((s) => s !== null)
    expect(known.length).toBeGreaterThan(0)
    expect(known).toEqual([...known].sort((a, b) => b - a))
    // Unscored links, if any, come after the scored ones.
    expect(scores.indexOf(null) === -1 || scores.indexOf(null) >= known.length).toBe(true)
    const context = buildGuessAssociationContext(view)
    expect(context).toContain('strongest first')
    expect(context).toContain('Strengths are LCSI ranks')
    expect(context).toContain('no key information')
  })
})
