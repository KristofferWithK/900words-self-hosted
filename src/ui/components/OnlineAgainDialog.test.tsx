import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { OnlineAgainDialog } from './OnlineAgainDialog'

describe('OnlineAgainDialog', () => {
  it('offers normal Casey back, says why staying offline can be right, and offers both', () => {
    const html = renderToStaticMarkup(<OnlineAgainDialog onPlayOnline={() => {}} onStayOffline={() => {}} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain(UI.game.onlineAgainTitle)
    // One key carries both halves: normal Casey is better, and an unsteady
    // connection is a reason to stay.
    expect(html).toContain(UI.game.onlineAgainBody)
    expect(html).toContain('data-action="play-online"')
    expect(html).toContain('data-action="stay-offline"')
    expect(html).toContain(UI.game.playOnlineButton)
    expect(html).toContain(UI.game.stayOfflineButton)
  })
})
