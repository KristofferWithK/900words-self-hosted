// Root-cause probe for the "black border around the green button" (build 88).
// Reproduces the EXACT context from the owner's screenshot: the round-guidance
// dialog, whose first button is auto-focused on open. The suspicion: the
// dialog's :focus-visible outline (3px solid --text, offset 4px) paints a
// black ring OUTSIDE the button's green border — black outer, white gap
// (offset), green ring (2px element border), white fill. Headless Chromium
// after showModal + programmatic .focus() DOES match :focus-visible, which is
// why earlier probes on .home-play (never focused) found nothing.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

// startPreview adds DRIVE_PORT_OFFSET itself; adding it here too moved this
// drive into another parallel slot's ports.
const PORT = 4400
const preview = await startPreview(PORT)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/data/toolchain/playwright-browsers/chromium-1234/chrome-linux64/chrome',
})
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
// The café gate is on (CW-13): this probe's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
const url = `${preview.base}?mock=1&howto=0&seed=7&city=0`
await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
await page.goto(url, { waitUntil: 'networkidle' })
await page.locator('.home-play').click()
await page.waitForSelector('.board-grid', { timeout: 20_000 })
await page.waitForSelector('dialog.round-guidance-dialog[open]', { timeout: 15_000 })

const ring = await page.evaluate(() => {
  const btn = document.querySelector('dialog.round-guidance-dialog[open] .tag')
  if (!btn) return null
  const cs = getComputedStyle(btn)
  return {
    activeElementIsButton: document.activeElement === btn,
    matchesFocusVisible: btn.matches(':focus-visible'),
    outlineStyle: cs.outlineStyle,
    outlineWidth: cs.outlineWidth,
    outlineColor: cs.outlineColor,
    outlineOffset: cs.outlineOffset,
    borderColor: cs.borderTopColor,
    borderWidth: cs.borderTopWidth,
    boxShadow: cs.boxShadow,
  }
})
console.log('AUTO-FOCUSED DIALOG BUTTON:', JSON.stringify(ring, null, 1))
await page.screenshot({ path: 'evidence/ring-focus-dialog-360.png' })
await browser.close()
preview.stop()
process.exit(0)