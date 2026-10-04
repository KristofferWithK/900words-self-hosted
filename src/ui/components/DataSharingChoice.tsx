import { useEffect, useState } from 'react'
import { deleteSharedData } from '../../dataSharing/client'
import { UI } from '../../i18n'
import { Tag } from './Tag'
import { useSettings, type DataSharingChoice as Choice } from '../../stores/settingsStore'

const choices: Array<{ value: Choice; title: string; detail: string }> = [
  {
    value: 'private',
    title: UI.settings.dataSharingPrivateTitle,
    detail: UI.settings.dataSharingPrivateDetail,
  },
  {
    value: 'diagnostics',
    title: UI.settings.dataSharingDiagnosticsTitle,
    detail: UI.settings.dataSharingDiagnosticsDetail,
  },
  {
    value: 'learning',
    title: UI.settings.dataSharingLearningTitle,
    detail: UI.settings.dataSharingLearningDetail,
  },
]

function ChoiceButtons({ onChoose }: { onChoose: (choice: Choice) => void }) {
  const selected = useSettings((s) => s.dataSharing)
  return (
    <div className="data-sharing-choices" role="radiogroup" aria-label={UI.settings.dataSharingAria}>
      {choices.map((choice) => (
        <button
          type="button"
          role="radio"
          aria-checked={selected === choice.value}
          className={`data-sharing-choice${selected === choice.value ? ' selected' : ''}`}
          key={choice.value}
          onClick={() => onChoose(choice.value)}
        >
          <strong>{choice.title}</strong>
          <span>{choice.detail}</span>
        </button>
      ))}
    </div>
  )
}

/** One non-blocking invitation, over the fixed summary rather than inside it. */
export function DataSharingPrompt({ eligible }: { eligible: boolean }) {
  const dataSharing = useSettings((s) => s.dataSharing)
  const shownAt = useSettings((s) => s.dataSharingPromptShownAt)
  const setSettings = useSettings((s) => s.set)
  // A self-built 900words with no Casey server has nowhere to share to.
  const hasServer = useSettings((s) => s.baseUrl.trim() !== '')
  const [open, setOpen] = useState(() => eligible && hasServer && dataSharing === null && shownAt === null)
  useEffect(() => {
    if (open && shownAt === null) setSettings({ dataSharingPromptShownAt: Date.now() })
  }, [open, shownAt, setSettings])
  if (!open || dataSharing !== null) return null
  return (
    <div className="data-sharing-scrim">
      <section
        className="data-sharing-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-sharing-title"
      >
        <button
          className="data-sharing-close"
          aria-label={UI.settings.dataSharingCloseAria}
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <h2 id="data-sharing-title">{UI.settings.dataSharingPromptTitle}</h2>
        <p>{UI.settings.dataSharingPromptNote}</p>
        <ChoiceButtons onChoose={(choice) => setSettings({ dataSharing: choice })} />
      </section>
    </div>
  )
}

export function DataSharingSettings() {
  const setSettings = useSettings((s) => s.set)
  const baseUrl = useSettings((s) => s.baseUrl)
  const [deleting, setDeleting] = useState(false)
  const choose = async (dataSharing: Choice) => {
    if (dataSharing === 'private') {
      setDeleting(true)
      await deleteSharedData(baseUrl)
      setDeleting(false)
    }
    setSettings({ dataSharing })
  }
  return (
    <>
      <ChoiceButtons onChoose={choose} />
      <p className="settings-note">{UI.settings.dataSharingSettingsNote}</p>
      <Tag
        size="wide"
        className="data-sharing-delete"
        disabled={deleting}
        onClick={() => void deleteSharedData(baseUrl)}
        label={deleting ? UI.settings.dataSharingDeleting : UI.settings.dataSharingDeleteButton}
      />
    </>
  )
}
