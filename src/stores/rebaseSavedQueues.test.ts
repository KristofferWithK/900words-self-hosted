/// <reference types="node" />
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CITY1_BOARD_CYCLE } from '../data/city1BoardCycle'
import { wordById } from '../data/words'
import { BOARD } from '../engine/config'
import { createGame } from '../engine/game'
import { createPrimaryContinuation, emptyProgressFacts } from '../progression/facts'
import { validatedReceiptFixture } from '../progression/fixtures'
import { boardKey } from '../progression/identity'
import { emptySettlementLedger } from '../progression/settlement'
import type { AttemptSlot, BoardIdentity, CourseSessions } from '../progression/types'
import { isSupersededQueue, knownRequiredSetsForCourse, requiredSetForCourse } from '../session/courseRuntime'

const values = new Map<string, string>()
const storage = { get length() { return values.size }, key: (index: number) => [...values.keys()][index] ?? null,
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) } }
vi.stubGlobal('localStorage', storage)
vi.stubGlobal('window', { localStorage: storage })
const { rebaseSavedQueues } = await import('./saveMigration')
const { SESSION_KEY, SETTLEMENT_KEY } = await import('./settlementStorage')
const { readSaveMigration } = await import('./saveTransfer')

const v2 = requiredSetForCourse('da')
const v1 = knownRequiredSetsForCourse('da')[0]!
const dropped = v1.boards.find((board) => !v2.boards.some((kept) => boardKey(kept) === boardKey(board)))!

function openRound(board: BoardIdentity): AttemptSlot {
  const authored = CITY1_BOARD_CYCLE.find((entry) => entry.id === board.authoredBoardId)!
  const game = createGame({
    config: { ...BOARD, greenOverlap: authored.greenOverlap },
    words: authored.wordIds.map((id) => {
      const w = wordById(id)!
      return { wordId: w.id, da: w.da, en: w.en, pos: w.pos, article: w.article, gender: w.gender, countable: w.countable }
    }),
    seed: Number.parseInt(authored.seedHex, 16) >>> 0, firstGiver: 'ai',
    authoredGreenIds: { player: authored.playerGreenIds, ai: authored.aiGreenIds },
  })
  return { attemptId: 'open-v1-round', board, origin: 'primary', promptLanguage: 'en', game, lookedUp: [], reviewRoundId: null,
    randomnessPolicy: 'engine-wheel-v1' }
}

function save(byCourse: Record<string, CourseSessions>, ledger = emptySettlementLedger()) {
  values.set(SESSION_KEY, JSON.stringify({ version: 1, state: { byCourse, results: {}, settlementEffects: {} } }))
  values.set(SETTLEMENT_KEY, JSON.stringify(ledger))
}
const stored = () => JSON.parse(values.get(SESSION_KEY)!).state.byCourse as Record<string, CourseSessions>

beforeEach(() => values.clear())

describe('rebaseSavedQueues, run at recovery', () => {
  it('moves a v1 queue onto v2 and archives the open round the move could not carry', () => {
    const facts = emptyProgressFacts()
    const primary = openRound(dropped)
    save({ da: { continuation: createPrimaryContinuation(v1, facts, dropped), primary, replay: null, activeSlot: 'primary' } })
    expect(rebaseSavedQueues(storage, 1234)).toBe(true)
    const da = stored().da!
    expect(da.continuation.requiredSet.setVersion).toBe('city1-required-boards-v2')
    expect(da.continuation.source).toBe('rebased')
    expect(da.continuation.remainingBoardKeys).toEqual(v2.boards.map(boardKey))
    expect(da.primary).toBeNull()
    const migration = readSaveMigration(storage)
    expect(migration.retired).toBe(true)
    expect(migration.noticeDismissed).toBe(false)
    expect(migration.archives?.map((entry) => entry.id)).toEqual(['rebased-open-v1-round'])
    // Idempotent: a second recovery finds nothing to move.
    const once = values.get(SESSION_KEY)
    expect(rebaseSavedQueues(storage, 5678)).toBe(true)
    expect(values.get(SESSION_KEY)).toBe(once)
  })

  it('writes nothing while a settlement is pending, and says so', () => {
    const facts = emptyProgressFacts()
    const sessions = { continuation: createPrimaryContinuation(v1, facts), primary: null, replay: null, activeSlot: null }
    save({ da: sessions }, validatedReceiptFixture().ledger)
    const before = values.get(SESSION_KEY)
    expect(rebaseSavedQueues(storage, 1234)).toBe(false)
    expect(values.get(SESSION_KEY)).toBe(before)
  })

  it('leaves a queue on the current set, and one naming no set this course superseded, untouched', () => {
    const facts = emptyProgressFacts()
    const current = { continuation: createPrimaryContinuation(v2, facts), primary: null, replay: null, activeSlot: null }
    const foreign = { ...current, continuation: { ...current.continuation, requiredSet: { ...current.continuation.requiredSet, setVersion: 'somebody-elses-v9' } } }
    expect(isSupersededQueue(current, 'da')).toBe(false)
    expect(isSupersededQueue(foreign, 'da')).toBe(false)
    save({ da: current })
    const before = values.get(SESSION_KEY)
    expect(rebaseSavedQueues(storage, 1234)).toBe(true)
    expect(values.get(SESSION_KEY)).toBe(before)
  })
})
