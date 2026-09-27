import { describe, expect, it } from 'vitest'
import { dailyReminderCopy, REMINDER_HOUR, REMINDER_MINUTE, reminderPromptDue } from './reminders'

describe('Casey’s one question about reminders', () => {
  const today = new Date(2026, 7, 23, 12)
  const base = { completedDays: { '2026-08-23': 3 }, now: today, dailyReminders: false, promptShownAt: null, available: true }

  it('comes after the third game of a day, on the iPhone, and only once', () => {
    expect(reminderPromptDue(base)).toBe(true)
    expect(reminderPromptDue({ ...base, completedDays: { '2026-08-23': 2 } })).toBe(false)
    expect(reminderPromptDue({ ...base, completedDays: { '2026-08-22': 3 } })).toBe(false)
    expect(reminderPromptDue({ ...base, available: false })).toBe(false)
    expect(reminderPromptDue({ ...base, promptShownAt: 1 })).toBe(false)
    expect(reminderPromptDue({ ...base, dailyReminders: true })).toBe(false)
  })
})

describe('daily reminder copy', () => {
  const today = new Date(2026, 7, 23, 12)

  it('is deterministic and derived only from the completed-day ledger', () => {
    const days = { '2026-08-22': 1, '2026-08-23': 1 }
    expect(dailyReminderCopy(days, today)).toEqual({
      title: 'Casey saved you a seat',
      body: '2 small games today are enough to begin a streak.',
    })
    expect(dailyReminderCopy(days, today)).toEqual(dailyReminderCopy(days, today))
  })

  it('uses the same three-game promise as Home, without storing a message history', () => {
    expect(dailyReminderCopy({ '2026-08-23': 1 }, today).body).toContain('2 small games')
    expect(dailyReminderCopy({ '2026-08-23': 2 }, today).body).toContain('one more game')
  })

  it('keeps the scheduled prompt in the afternoon, with the evening still ahead to play in', () => {
    expect([REMINDER_HOUR, REMINDER_MINUTE]).toEqual([15, 0])
  })
})
