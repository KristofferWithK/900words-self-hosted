import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { LeaveGameDialog } from './LeaveGameDialog'

describe('LeaveGameDialog', () => {
  it('states the resume-versus-discard consequence and exposes all three decisions', () => {
    const html = renderToStaticMarkup(
      <LeaveGameDialog onKeepPlaying={() => {}} onPause={() => {}} onCancelRound={() => {}} />,
    )
    expect(html).toContain('role="dialog"')
    // One key carries both halves of the consequence: pause keeps the board,
    // cancel discards it and Play starts a new round.
    expect(html).toContain(UI.game.leaveBody)
    expect(html).toContain(UI.game.leaveKeepPlaying)
    expect(html).toContain(UI.game.leavePause)
    expect(html).toContain(UI.game.leaveCancelRound)
  })
})
