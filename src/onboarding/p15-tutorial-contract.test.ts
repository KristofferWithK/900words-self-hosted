import { describe, expect, it } from 'vitest'
import { CITY1_REQUIRED_BOARDS } from '../data/city1RequiredBoardManifest'
import { CITY1_BOARD_CYCLE } from '../data/city1BoardCycle'
import { BOARD, TUTORIAL_CONFIG } from '../engine/config'
import { UI } from '../i18n'
import { emptyProgressFacts } from '../progression/facts'
import { firstCompletionKey } from '../progression/identity'
import { FIXTURE_BOARD, PLAYTEST_FIXTURES } from '../progression/fixtures'
import { claimTutorialAward, tutorialAwardIdentity } from '../progression/tutorialAward'
import { CITY1_REQUIRED_SET, initialCourseSessions, nextRequiredBoard, requiredSetForCourse } from '../session/courseRuntime'
import { TUTORIAL_ROLES, TUTORIAL_SEED, TUTORIAL_WORD_IDS } from './tutorial'
import { TUTORIAL_FINISH_LINE } from '../ui/components/TutorialPractice'
import { decideOnboarding, markOnboardDone, writeOnboardStep } from './flow'

describe('P15 fixed tutorial-to-first-board contract', () => {
  it('pins the first required normal board to the manifest and authored runtime', () => {
    const freshFacts = emptyProgressFacts()
    const freshSessions = initialCourseSessions(freshFacts)
    const next = nextRequiredBoard(freshSessions, freshFacts)
    expect(next).not.toBeNull()
    expect(next?.authoredBoardId).toBe('bank_001')
    expect(next?.contentRevision).toBe('1')
    expect(freshSessions.continuation.remainingBoardKeys.slice(0, 2)).toEqual([
      '["da","sonderborg","bank_001","1"]', '["da","sonderborg","bank_002","1"]',
    ])
    const entry = CITY1_REQUIRED_BOARDS.at(0)
    expect(entry.identity).toEqual({ courseId: 'da', cityId: 'sonderborg', authoredBoardId: 'bank_001', contentRevision: '1' })
    expect(CITY1_REQUIRED_BOARDS.setVersion).toBe('city1-required-boards-v1')
    expect(entry.board).toMatchObject({
      id: 'bank_001', seedHex: '00007551', firstGiver: 'player', greenOverlap: 1,
      wordIds: ['da:by', 'da:land', 'da:klokke', 'da:måned', 'da:menneske', 'da:lille', 'da:halv', 'da:svær', 'da:synes', 'da:komme', 'da:bo', 'da:sidste', 'da:hus', 'da:mulig', 'da:liv', 'da:hel', 'da:sikker', 'da:uge'],
      playerGreenIds: ['da:menneske', 'da:bo', 'da:land', 'da:lille', 'da:hus', 'da:by', 'da:mulig', 'da:sikker'],
      aiGreenIds: ['da:sikker', 'da:liv', 'da:klokke', 'da:uge', 'da:sidste', 'da:måned', 'da:hel', 'da:halv'],
    })
    expect(CITY1_BOARD_CYCLE[0]).toEqual(entry.board)
    expect(BOARD).toMatchObject({ rows: 6, cols: 3, totalWords: 18, greenOverlap: 3 })
    expect(CITY1_REQUIRED_BOARDS.at(1).identity.authoredBoardId).toBe('bank_002')

    // A settled first primary advances only the primary queue. The replay
    // route is deliberately a separate presentation path and cannot change
    // this successor identity.
    const completedFacts = {
      ...freshFacts,
      firstPrimaryCompletions: {
        [firstCompletionKey(CITY1_REQUIRED_SET.boards[0]!)]: {
          board: CITY1_REQUIRED_SET.boards[0]!, requiredSet: CITY1_REQUIRED_SET,
        },
      },
    }
    expect(nextRequiredBoard(initialCourseSessions(completedFacts), completedFacts)?.authoredBoardId).toBe('bank_002')
  })

  it('hands a German first-run course into its own first City 1 board', () => {
    const germanSet = requiredSetForCourse('de')
    const freshFacts = emptyProgressFacts()
    const freshSessions = initialCourseSessions(freshFacts, 'de')
    const next = nextRequiredBoard(freshSessions, freshFacts, germanSet)
    expect(next).toMatchObject({
      courseId: 'de',
      cityId: germanSet.cityId,
      authoredBoardId: 'bank_001',
      contentRevision: '1',
    })
    expect(germanSet.boards[0]).toEqual(next)
    expect(germanSet.cityId).not.toBe(CITY1_REQUIRED_SET.cityId)
  })

  it('pins the authored practice shape and existing script keys', () => {
    expect(TUTORIAL_SEED).toBe(2020)
    expect(TUTORIAL_CONFIG).toMatchObject({ rows: 3, cols: 3, totalWords: 9, greensPerSide: 4, greenOverlap: 1 })
    expect(TUTORIAL_WORD_IDS).toHaveLength(9)
    expect([...Object.values(TUTORIAL_ROLES).flat()].sort()).toEqual([...TUTORIAL_WORD_IDS].sort())
    expect(typeof UI.onboarding.practiceIntro).toBe('string')
    expect(typeof UI.onboarding.practiceTranslation).toBe('string')
    expect(typeof UI.onboarding.practiceWheelReady).toBe('string')
    expect(typeof UI.onboarding.practiceFinish).toBe('string')
    // The practice beats must never emit the retired “dictionary is closed”
    // instruction. This checks observable copy, not prohibited-key presence.
    const forbidden = UI.game.dictionaryClosed
    expect([UI.onboarding.practiceIntro, UI.onboarding.practiceTranslation, UI.onboarding.practiceWheelReady, UI.onboarding.practiceFinish, TUTORIAL_FINISH_LINE]).not.toContain(forbidden)
  })

  it('pins fresh, skip, resume and repeat-award boundaries without moving the queue', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    expect(decideOnboarding(storage)).toEqual({ kind: 'fresh' })
    writeOnboardStep('tutorial', storage)
    expect(decideOnboarding(storage)).toEqual({ kind: 'resume', step: 'tutorial' })
    markOnboardDone(storage)
    expect(decideOnboarding(storage)).toEqual({ kind: 'done' })

    const identity = tutorialAwardIdentity('profile-local-p15', FIXTURE_BOARD)
    const first = claimTutorialAward(emptyProgressFacts(), identity, PLAYTEST_FIXTURES.oneTimePracticeReward, 1)
    expect(first.status).toBe('new')
    const replay = claimTutorialAward(first.facts, identity, { ...PLAYTEST_FIXTURES.oneTimePracticeReward, attemptId: 'practice-replay' }, 2)
    expect(replay).toMatchObject({ status: 'already-held', postcards: 0 })
    const miss = claimTutorialAward(emptyProgressFacts(), identity, { ...PLAYTEST_FIXTURES.solvedMiss, origin: 'tutorial' }, 3)
    expect(miss.status).toBe('not-eligible')
  })
})
