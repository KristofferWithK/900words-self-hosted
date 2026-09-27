import { describe, expect, it, vi } from 'vitest'
import { commitSaveTransfer, recoverSaveTransfer, SAVE_TRANSFER_KEY, type SaveKey } from './saveTransfer'
import { transferAwareStorage } from './settlementStorage'
import { FIXTURE_BOARD, FIXTURE_SET, MATRIX_FIXTURES } from '../progression/fixtures'

// Importing recovery must never initialize language/data or hydrated stores.
vi.mock('../lang/active', () => { throw new Error('Save transfer must be pre-hydration safe') })

const envelope = (version: number, state: unknown) => ({ version, state })
const facts = { boards: {}, firstPrimaryCompletions: {}, milestones: {}, cityAchievements: {},
  legacyCredit: { identity: 'danish-city1-legacy-v1', amount: 7 } }
const curriculum = { routeLanguage: 'da', itemStates: {}, evidence: {}, dueAt: {}, activeItemId: null, sentenceReviewEvidence: {} }
const survival = { routeLanguage: 'da', exchanges: {} }
const route = { cityIndex: 0, arrivedAt: {}, furthest: 0 }
const current: Record<SaveKey, unknown> = {
  'cluecab-srs-v1': envelope(7, { stats: {}, games: { played: 0, won: 0, lost: 0, redeemed: 0 }, translationPostcards: 7, settlementEffects: {} }),
  'cluecab-journey-v2': envelope(7, { ...route, wrapped: {}, routeLanguage: 'da', parked: {}, historicalRoutes: {}, historicalTravelEligibility: {}, waitingForTrain: false }),
  'cluecab-curriculum-v1': envelope(3, { byLanguage: { da: curriculum }, settlementEffects: {}, settlementMilestones: {} }),
  'cluecab-survival-v1': envelope(2, { byLanguage: { da: survival }, settlementEffects: {}, settlementMilestones: {} }),
  'cluecab-streak-v1': envelope(2, { completedDays: { '2026-09-20': 2 }, settlementEffects: {} }),
  'cluecab-associations-v1': envelope(2, { groups: { 'da:a|da:b': { ids: ['da:a', 'da:b'], by: 'player', count: 1, lastAt: 10 } }, traps: { 'da:a|da:b': ['da:c'] }, settlementEffects: {} }),
  'cluecab-game-v1': envelope(17, { game: null, parked: null, legacySave: null, attemptId: null, attemptOrigin: null,
    activeSlot: null, roundRecorded: false, reviewRoundId: null, sentenceReview: null }),
  'cluecab-settlement-v1': { schemaVersion: 1, facts, settlements: {} },
  'cluecab-progression-sessions-v1': envelope(1, { byCourse: { da: { continuation: {
    requiredSet: { courseId: 'da', cityId: 'sonderborg', setVersion: 'test-v1' }, remainingBoardKeys: [], source: 'canonical' },
    primary: null, replay: null, activeSlot: null } }, results: {}, settlementEffects: {} }),
  'cluecab-save-migration-v1': { version: 1, migratedAt: 10, legacyCreditSource: 7, retired: false, evidence: {}, archives: [] },
  'cluecab-daily:2026-09-20': envelope(1, { outcome: null, settlementEffects: {} }),
}
const row = (key: SaveKey, value: unknown) => ({ key, value: JSON.stringify(value) })
const stateOf = (key: SaveKey) => (current[key] as { state: object }).state
const sessionWithRound = (round: unknown) => envelope(1, { byCourse: { da: {
  continuation: { requiredSet: FIXTURE_SET, remainingBoardKeys: [], source: 'canonical' },
  primary: { attemptId: 'old', board: FIXTURE_BOARD, origin: 'primary', promptLanguage: 'en', game: MATRIX_FIXTURES[0].game,
    lookedUp: [], reviewRoundId: 'review', randomnessPolicy: 'engine-wheel-v1', round }, replay: null, activeSlot: 'primary',
} }, results: {}, settlementEffects: {} })

// Deliberately recomputed independently: corruption detection is NOT trust.
function journal(writes: { key: SaveKey; value: string }[]) {
  let hash = 0x811c9dc5
  for (const char of JSON.stringify(writes)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193)
  return JSON.stringify({ version: 1, writes, fingerprint: (hash >>> 0).toString(16).padStart(8, '0') })
}
function fixture() {
  const values = new Map(Object.entries(current).map(([key, value]) => [key, JSON.stringify(value)]))
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }) }
  return { values, storage }
}

const invalid: [string, SaveKey, unknown][] = [
  ...Object.entries(current).filter(([key]) => key !== 'cluecab-save-migration-v1').map(([key, value]): [string, SaveKey, unknown] =>
    [`empty ${key}`, key as SaveKey, key === 'cluecab-settlement-v1' ? { schemaVersion: 1, facts: {}, settlements: {} }
      : envelope((value as { version: number }).version, {})]),
  ['negative SRS stat', 'cluecab-srs-v1', envelope(7, { ...(current['cluecab-srs-v1'] as { state: object }).state,
    stats: { 'da:a': { box: -1, lastSeenAt: 0, seen: 0, correctGuesses: 0, misses: 0, lookups: 0, redemptionRight: 0, redemptionWrong: 0, greenByClue: 0, greenByGuess: 0 } } })],
  ['journey history timestamp', 'cluecab-journey-v2', envelope(7, { ...(current['cluecab-journey-v2'] as { state: object }).state,
    historicalRoutes: { da: { cityIndex: 2, arrivedAt: { 2: -1 } } } })],
  ['journey invented eligibility key', 'cluecab-journey-v2', envelope(7, { ...(current['cluecab-journey-v2'] as { state: object }).state,
    historicalTravelEligibility: { everywhere: true } })],
  ['curriculum malformed evidence', 'cluecab-curriculum-v1', envelope(3, { byLanguage: { da: { ...curriculum, evidence: { lesson: [{}] } } }, settlementEffects: {}, settlementMilestones: {} })],
  ['curriculum wrong language', 'cluecab-curriculum-v1', envelope(3, { byLanguage: { de: curriculum }, settlementEffects: {}, settlementMilestones: {} })],
  ['curriculum invalid sentence evidence', 'cluecab-curriculum-v1', envelope(3, { byLanguage: { da: { ...curriculum, sentenceReviewEvidence: { word: [{ wordId: 'a', focusId: 'b', attemptedAt: 1, correct: true, exposure: true, retrieval: false }] } } }, settlementEffects: {}, settlementMilestones: {} })],
  ['Survival malformed exchange', 'cluecab-survival-v1', envelope(2, { byLanguage: { da: { ...survival, exchanges: { lesson: { unlockedAt: 1, replayedAt: ['yesterday'] } } } }, settlementEffects: {}, settlementMilestones: {} })],
  ['Survival wrong language', 'cluecab-survival-v1', envelope(2, { byLanguage: { de: survival }, settlementEffects: {}, settlementMilestones: {} })],
  ['sessions missing ownership', 'cluecab-progression-sessions-v1', envelope(1, { byCourse: { da: {} }, results: {}, settlementEffects: {} })],
  ['sessions wrong result receipt', 'cluecab-progression-sessions-v1', envelope(1, { byCourse: {}, results: { attempt: { receiptId: 'other', reviewRoundId: null } }, settlementEffects: {} })],
  ['sessions wrong course', 'cluecab-progression-sessions-v1', envelope(1, { byCourse: { de: { continuation: { requiredSet: { courseId: 'da', cityId: 'sonderborg', setVersion: 'v1' }, remainingBoardKeys: [], source: 'canonical' }, primary: null, replay: null, activeSlot: null } }, results: {}, settlementEffects: {} })],
  ['session malformed round guidance', 'cluecab-progression-sessions-v1', sessionWithRound({ roundGuidance: 'bad' })],
  ['session round cannot replace live actions', 'cluecab-progression-sessions-v1', sessionWithRound({ newGame: 'bad' })],
  ['session malformed sentence queue', 'cluecab-progression-sessions-v1', sessionWithRound({ sentenceReview: { version: 1, roundId: 'review', queue: [], cursor: 2, dismissed: false } })],
  ['session wrong sentence owner', 'cluecab-progression-sessions-v1', sessionWithRound({ sentenceReview: { version: 1, roundId: 'other', queue: [], cursor: 0, dismissed: false } })],
  ['ledger invalid receipt', 'cluecab-settlement-v1', { schemaVersion: 1, facts, settlements: { attempt: { receipt: {}, acknowledgedEffects: [] } } }],
  ['game cache cannot carry a playable slot', 'cluecab-game-v1', envelope(17, { ...(current['cluecab-game-v1'] as { state: object }).state, game: {} })],
  ['streak invalid calendar date', 'cluecab-streak-v1', envelope(2, { completedDays: { '2026-02-30': 1 }, settlementEffects: {} })],
  ['associations malformed group', 'cluecab-associations-v1', envelope(2, { groups: { group: { ids: ['a', 'b'], by: 'robot', count: 1, lastAt: 0 } }, traps: {}, settlementEffects: {} })],
  ['associations wrong key', 'cluecab-associations-v1', envelope(2, { groups: { wrong: { ids: ['a', 'b'], by: 'player', count: 1, lastAt: 0 } }, traps: {}, settlementEffects: {} })],
  ['migration invalid evidence', 'cluecab-save-migration-v1', { version: 1, migratedAt: 1, evidence: { game: 'not a game' } }],
  ['migration invalid archive', 'cluecab-save-migration-v1', { version: 1, migratedAt: 1, archives: [{ id: 'old', at: 1, evidence: { lookedUp: [7] } }] }],
  ['migration invalid archive timestamp', 'cluecab-save-migration-v1', { version: 1, migratedAt: 1, archives: [{ id: 'old', at: -1, evidence: {} }] }],
  ['daily invalid marker', 'cluecab-daily:2026-09-20', envelope(1, { outcome: null, settlementEffects: { effect: '' } })],
  ['unsupported old game journal', 'cluecab-game-v1', envelope(15, {})],
  // A matching FNV checksum is not authority. These would overwrite live
  // Zustand actions after recovery because persist merges saved state last.
  ['SRS action injection', 'cluecab-srs-v1', envelope(7, { ...stateOf('cluecab-srs-v1'), recordRound: null })],
  ['SRS envelope injection', 'cluecab-srs-v1', { ...envelope(7, stateOf('cluecab-srs-v1')), recordRound: null }],
  ['journey action injection', 'cluecab-journey-v2', envelope(7, { ...stateOf('cluecab-journey-v2'), travel: null })],
  ['journey envelope injection', 'cluecab-journey-v2', { ...envelope(7, stateOf('cluecab-journey-v2')), travel: null }],
  ['curriculum action injection', 'cluecab-curriculum-v1', envelope(3, { ...stateOf('cluecab-curriculum-v1'), start: null })],
  ['curriculum nested action injection', 'cluecab-curriculum-v1', envelope(3, { ...stateOf('cluecab-curriculum-v1'),
    byLanguage: { da: { ...curriculum, start: null } } })],
  ['Survival action injection', 'cluecab-survival-v1', envelope(2, { ...stateOf('cluecab-survival-v1'), complete: null })],
  ['Survival nested action injection', 'cluecab-survival-v1', envelope(2, { ...stateOf('cluecab-survival-v1'),
    byLanguage: { da: { ...survival, complete: null } } })],
  ['streak action injection', 'cluecab-streak-v1', envelope(2, { ...stateOf('cluecab-streak-v1'), reset: null })],
  ['associations action injection', 'cluecab-associations-v1', envelope(2, { ...stateOf('cluecab-associations-v1'), clear: null })],
  ['daily unexpected property', 'cluecab-daily:2026-09-20', envelope(1, { ...stateOf('cluecab-daily:2026-09-20'), reset: null })],
  ['sessions unexpected property', 'cluecab-progression-sessions-v1', envelope(1, { ...(stateOf('cluecab-progression-sessions-v1')), start: null })],
  ['migration unexpected property', 'cluecab-save-migration-v1', { ...(current['cluecab-save-migration-v1'] as object), retry: null }],
  ['settlement unexpected property', 'cluecab-settlement-v1', { ...(current['cluecab-settlement-v1'] as object), apply: null }],
]

describe('semantic save-transfer destinations, independent of fingerprint', () => {
  it.each(['journal', 'metadata'])('holds automatic hydration writes/deletes during unresolved %s and resumes after recovery', kind => {
    const { values, storage } = fixture()
    const disk = { ...storage, removeItem: vi.fn((key: string) => { values.delete(key) }) }
    const guarded = transferAwareStorage(disk)
    const key = kind === 'journal' ? SAVE_TRANSFER_KEY : 'cluecab-save-migration-v1'
    values.set(key, '{invalid')
    const before = [...values]
    expect(guarded.getItem('cluecab-srs-v1')).toBe(values.get('cluecab-srs-v1'))
    guarded.setItem('cluecab-srs-v1', 'automatic migration')
    guarded.removeItem('cluecab-srs-v1')
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(disk.removeItem).not.toHaveBeenCalled()
    expect([...values]).toEqual(before)
    values.delete(key)
    guarded.setItem('cluecab-srs-v1', 'recovered projection')
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('cluecab-srs-v1', 'recovered projection')
  })

  it.each(invalid)('rejects %s with matching fingerprint before ANY write', (_label, key, value) => {
    const { values, storage } = fixture()
    // This first row would change a valid store if recovery validated as it went.
    const firstKey = key === 'cluecab-daily:2026-09-20' ? 'cluecab-save-migration-v1' : 'cluecab-daily:2026-09-20'
    const firstValue = firstKey === 'cluecab-save-migration-v1' ? { version: 1, migratedAt: 99 }
      : envelope(1, { outcome: 'won', settlementEffects: {} })
    const writes = [row(firstKey, firstValue), row(key, value)]
    values.set(SAVE_TRANSFER_KEY, journal(writes))
    const before = [...values]
    expect(() => recoverSaveTransfer(storage)).toThrow()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect([...values]).toEqual(before)
    values.delete(SAVE_TRANSFER_KEY)
    const beforeCommit = [...values]
    expect(() => commitSaveTransfer(storage, writes)).toThrow()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect([...values]).toEqual(beforeCommit)
  })

  it('recovers every actual current destination version exactly, and is idempotent', () => {
    const { values, storage } = fixture()
    const writes = Object.entries(current).map(([key, value]) => row(key as SaveKey, value))
    values.set(SAVE_TRANSFER_KEY, journal(writes))
    recoverSaveTransfer(storage)
    expect(storage.setItem).toHaveBeenCalledTimes(writes.length + 1)
    for (const write of writes) expect(values.get(write.key)).toBe(write.value)
    storage.setItem.mockClear()
    recoverSaveTransfer(storage)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it.each([0, 1, 2, 3, 4, 5, 6, 7])('recovers a retained legacy journey v%s without rewriting its history', version => {
    const { values, storage } = fixture()
    const state = { cityIndex: 2, arrivedAt: { 2: 100 }, ...(version < 3 ? { banked: { 'da:hus': 90 } } : { wrapped: { 'da:hus': 90 } }),
      ...(version < 3 ? { stamps: { 0: 1 }, trialsSpent: { 0: 2 },
        activeExam: { cityIndex: 0, wordIds: ['da:hus'], answers: { 'da:hus': 'house' } }, lastPaper: ['da:hus'] } : {}),
      ...(version >= 5 ? { routeLanguage: 'da', parked: {} } : {}), historicalTravelEligibility: {},
      ...(version >= 7 ? { historicalRoutes: { da: { cityIndex: 2, arrivedAt: { 2: 100 } } } } : {}) }
    const write = row('cluecab-journey-v2', envelope(version, state))
    values.set(SAVE_TRANSFER_KEY, journal([write]))
    recoverSaveTransfer(storage)
    expect(values.get(write.key)).toBe(write.value)
  })
})
