import { useState } from 'react'
import { UI, UI_LANGUAGE } from '../../i18n'
import { readReviewGrant, unlockReviewAccess, type ReviewGrant } from '../../purchase/reviewAccess'

type Feedback = 'invalid' | 'rate-limited' | 'error' | null

function storedGrant(): ReviewGrant | null {
  try {
    return readReviewGrant(localStorage)
  } catch {
    return null
  }
}

/**
 * Google Play review access (src/purchase/reviewAccess.ts). Settings renders it
 * only in the Android store build; the Play Console reviewer instructions name
 * this section, so its place at the bottom of Settings is part of that text.
 */
export function ReviewAccessPanel() {
  const [grant, setGrant] = useState<ReviewGrant | null>(storedGrant)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const unlock = async () => {
    setBusy(true)
    setFeedback(null)
    const result = await unlockReviewAccess(code)
    setBusy(false)
    if (result.outcome === 'granted') {
      setGrant(result.grant)
      setCode('')
      return
    }
    setFeedback(result.outcome === 'invalid' ? 'invalid' : result.outcome === 'rate-limited' ? 'rate-limited' : 'error')
  }

  if (grant) {
    return (
      <p className="test-ok" role="status">
        {UI.settings.reviewAccessOn(new Date(grant.expiresAt).toLocaleDateString(UI_LANGUAGE))}
      </p>
    )
  }

  return (
    <form
      className="review-access"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy && code.trim()) void unlock()
      }}
    >
      <p className="settings-note">{UI.settings.reviewAccessHelp}</p>
      <label className="field">
        <span>{UI.settings.reviewAccessLabel}</span>
        <input
          type="text"
          value={code}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>
        {busy ? UI.settings.reviewAccessChecking : UI.settings.reviewAccessUnlock}
      </button>
      {feedback && (
        <p role="alert" className="test-fail">
          {feedback === 'invalid'
            ? UI.settings.reviewAccessInvalid
            : feedback === 'rate-limited'
              ? UI.settings.reviewAccessRateLimited
              : UI.settings.reviewAccessError}
        </p>
      )}
    </form>
  )
}
