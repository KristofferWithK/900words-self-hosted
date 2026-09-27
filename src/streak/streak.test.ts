import { beforeEach, describe, expect, it } from 'vitest'
import { currentStreak, dayKey, daysToKnownWords, useStreak } from './streak'

describe('Casey’s completed-day streak', () => {
  const today = new Date(2026, 7, 23, 12).getTime()
  const yesterday = new Date(2026, 7, 22, 12).getTime()
  const twoDaysAgo = new Date(2026, 7, 21, 12).getTime()

  beforeEach(() => useStreak.setState({ completedDays: {} }))

  it('counts consecutive completed local days, never an opened application', () => {
    expect(currentStreak({}, today)).toBe(0)
    expect(currentStreak({ [dayKey(today)]: 1 }, today)).toBe(1)
    expect(currentStreak({ [dayKey(today)]: 2, [dayKey(yesterday)]: 1, [dayKey(twoDaysAgo)]: 3 }, today)).toBe(3)
    expect(currentStreak({ [dayKey(today)]: 1, [dayKey(twoDaysAgo)]: 1 }, today)).toBe(1)
  })

  it('survives the morning: a run played through yesterday still counts before today’s first game', () => {
    // The badge used to read 0 until the first game of the day, and the
    // reminder offered to "begin a streak" to someone about to lose one.
    expect(currentStreak({ [dayKey(yesterday)]: 1, [dayKey(twoDaysAgo)]: 2 }, today)).toBe(2)
    // Today's first game then extends it rather than restarting it.
    expect(currentStreak({ [dayKey(today)]: 1, [dayKey(yesterday)]: 1, [dayKey(twoDaysAgo)]: 2 }, today)).toBe(3)
    // But a day missed BEFORE yesterday is still a break.
    expect(currentStreak({ [dayKey(twoDaysAgo)]: 2 }, today)).toBe(0)
  })

  it('records each finished game while preserving the one-day streak meaning', () => {
    useStreak.getState().recordCompletedGame(today)
    useStreak.getState().recordCompletedGame(today)
    expect(useStreak.getState().completedDays[dayKey(today)]).toBe(2)
    expect(currentStreak(useStreak.getState().completedDays, today)).toBe(1)
  })

  it('uses the fixed ten-words-a-day routine countdown', () => {
    expect(daysToKnownWords(0)).toBe(90)
    expect(daysToKnownWords(100)).toBe(80)
    expect(daysToKnownWords(0, 100)).toBe(80)
    expect(daysToKnownWords(900, 100)).toBe(0)
  })
})
