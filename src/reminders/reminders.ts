import { Capacitor, registerPlugin } from '@capacitor/core'
import { UI } from '../i18n'
import { DAILY_GAMES_GOAL, currentStreak, dayKey, type CompletedDays, useStreak } from '../streak/streak'
import { useSettings } from '../stores/settingsStore'

/**
 * Casey checks in in the afternoon (owner, 2026-09-07: "not just in the
 * evening — in the afternoon"), a civil local time with the evening still
 * ahead to play in. The hour travels to the native plugin with every
 * schedule call, so this is the one place it is written.
 */
export const REMINDER_HOUR = 15
export const REMINDER_MINUTE = 0

export type ReminderPermission = 'not-determined' | 'authorized' | 'denied' | 'unavailable' | 'error'

export interface ReminderCopy {
  title: string
  body: string
}

/** What the plugin is handed: the words, and the local time to say them. */
export interface ReminderSchedule extends ReminderCopy {
  hour: number
  minute: number
}

interface NativeRemindersPlugin {
  status(): Promise<{ permission: Exclude<ReminderPermission, 'unavailable' | 'error'> }>
  enable(options: ReminderSchedule): Promise<{ enabled: boolean; permission: Exclude<ReminderPermission, 'unavailable' | 'error'> }>
  reschedule(options: ReminderSchedule): Promise<{ scheduled: boolean }>
  disable(): Promise<void>
  openSettings(): Promise<void>
}

const scheduled = (copy: ReminderCopy): ReminderSchedule => ({ ...copy, hour: REMINDER_HOUR, minute: REMINDER_MINUTE })

const NativeReminders = registerPlugin<NativeRemindersPlugin>('Reminders')

/** Local notifications are an iPhone feature; a web page never asks for them. */
export function remindersAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

/**
 * The whole reminder is derived locally from the same completed-day ledger
 * Home uses. There is no device token, account id, server request, or remote
 * push payload anywhere in this feature.
 */
export function dailyReminderCopy(days: CompletedDays, now: number | Date): ReminderCopy {
  const today = days[dayKey(now)] ?? 0
  const left = Math.max(0, DAILY_GAMES_GOAL - today)
  const streak = currentStreak(days, now)

  if (left === 0) {
    return { title: UI.settings.reminderDoneTitle, body: UI.settings.reminderDoneBody }
  }
  if (left === 1) {
    return streak > 0
      ? { title: UI.settings.reminderOneLeftTitle, body: UI.settings.reminderStreakBody(streak) }
      : { title: UI.settings.reminderOneLeftTitle, body: UI.settings.reminderOneLeftBody }
  }
  return { title: UI.settings.reminderSeatTitle, body: UI.settings.reminderSeatBody(left) }
}

export async function readReminderPermission(): Promise<ReminderPermission> {
  if (!remindersAvailable()) return 'unavailable'
  try {
    return (await NativeReminders.status()).permission
  } catch {
    return 'error'
  }
}

/**
 * Is this the moment Casey asks about the daily reminder?
 *
 * Once, after the third game of a day — the day the player has just kept
 * Home's three-games promise for the first time, which is when a reminder
 * means something (owner, 2026-09-07: "that's the moment to make the
 * decision"). Never again after that, whatever they answered; Settings keeps
 * the switch. Only where a reminder can exist at all (the iPhone app), and
 * never for a player who already has one on.
 */
export function reminderPromptDue(input: {
  completedDays: CompletedDays
  now: number | Date
  dailyReminders: boolean
  promptShownAt: number | null
  available: boolean
}): boolean {
  if (!input.available || input.dailyReminders || input.promptShownAt !== null) return false
  return (input.completedDays[dayKey(input.now)] ?? 0) >= DAILY_GAMES_GOAL
}

/** Called from Casey's one prompt and from the Settings button — never on launch or a game finish. */
export async function requestDailyReminders(copy: ReminderCopy): Promise<ReminderPermission> {
  if (!remindersAvailable()) return 'unavailable'
  try {
    const result = await NativeReminders.enable(scheduled(copy))
    return result.enabled ? 'authorized' : result.permission
  } catch {
    return 'error'
  }
}

/** Removes the one pending local notification; a failed removal stays visible in Settings. */
export async function disableDailyReminders(): Promise<boolean> {
  if (!remindersAvailable()) return false
  try {
    await NativeReminders.disable()
    return true
  } catch {
    return false
  }
}

/** The player, not the app, changes a denial in Apple’s own Settings screen. */
export async function openReminderSettings(): Promise<void> {
  if (!remindersAvailable()) return
  try {
    await NativeReminders.openSettings()
  } catch {
    // The explanatory Settings copy remains useful if iOS cannot open it.
  }
}

/**
 * A finished game may refresh the already-authorized copy. It deliberately
 * cannot ask iOS for permission: consent has one explicit Settings entry
 * point, and only the locally persisted preference can reach this method.
 */
export async function refreshDailyReminder(): Promise<void> {
  if (!useSettings.getState().dailyReminders || !remindersAvailable()) return
  try {
    await NativeReminders.reschedule(scheduled(dailyReminderCopy(useStreak.getState().completedDays, Date.now())))
  } catch {
    // The Settings screen shows Apple’s current permission state next time it opens.
  }
}
