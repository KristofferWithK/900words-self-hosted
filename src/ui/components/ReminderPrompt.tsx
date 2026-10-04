import { useEffect, useState } from 'react'
import { UI } from '../../i18n'
import { Tag } from './Tag'
import { track } from '../../analytics/stats'
import {
  REMINDER_HOUR,
  dailyReminderCopy,
  reminderPromptDue,
  remindersAvailable,
  requestDailyReminders,
} from '../../reminders/reminders'
import { useSettings } from '../../stores/settingsStore'
import { useStreak } from '../../streak/streak'
import { ClueyFace } from './Cluey'

/**
 * Casey's one question about the daily reminder, asked over the summary of
 * the third game of a day (`reminderPromptDue`). A yes goes straight to
 * Apple's permission sheet; a no is remembered and she never asks again.
 * Settings keeps the switch either way. Borrows the data-sharing prompt's
 * shell, which already sits over the fixed summary without touching its
 * layout.
 */
export function ReminderPrompt({ eligible }: { eligible: boolean }) {
  const completedDays = useStreak((s) => s.completedDays)
  const dailyReminders = useSettings((s) => s.dailyReminders)
  const shownAt = useSettings((s) => s.reminderPromptShownAt)
  const setSettings = useSettings((s) => s.set)
  const [open, setOpen] = useState(
    () =>
      eligible &&
      reminderPromptDue({
        completedDays,
        now: Date.now(),
        dailyReminders,
        promptShownAt: shownAt,
        available: remindersAvailable(),
      }),
  )
  const [busy, setBusy] = useState(false)
  // Asked is asked: the stamp is written the moment she speaks, so a closed
  // app or a tap elsewhere does not turn one question into a daily one.
  useEffect(() => {
    if (open && shownAt === null) setSettings({ reminderPromptShownAt: Date.now() })
  }, [open, shownAt, setSettings])
  if (!open) return null

  const decline = () => {
    track({ name: 'reminder_prompt', outcome: 'no' })
    setOpen(false)
  }
  const accept = async () => {
    setBusy(true)
    track({ name: 'reminder_prompt', outcome: 'yes' })
    const permission = await requestDailyReminders(dailyReminderCopy(useStreak.getState().completedDays, Date.now()))
    if (permission === 'authorized') setSettings({ dailyReminders: true })
    setBusy(false)
    setOpen(false)
  }
  const hour = `${REMINDER_HOUR}:00`

  return (
    <div className="data-sharing-scrim">
      <section
        className="data-sharing-prompt reminder-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-prompt-title"
      >
        <button className="data-sharing-close" aria-label={UI.settings.reminderPromptCloseAria} onClick={decline}>
          ×
        </button>
        <div className="ai-say">
          <ClueyFace mood="happy" className="cluey-mini" />
          <h2 id="reminder-prompt-title">{UI.settings.reminderPromptTitle}</h2>
        </div>
        <p>{UI.settings.reminderPromptBody(hour)}</p>
        <div className="leave-game-actions">
          <Tag
            size="wide"
            tone="primary"
            disabled={busy}
            onClick={() => void accept()}
            label={busy ? UI.settings.reminderPromptAsking : UI.settings.reminderPromptAccept}
          />
          <Tag size="wide" disabled={busy} onClick={decline} label={UI.settings.reminderPromptDecline} />
        </div>
      </section>
    </div>
  )
}
