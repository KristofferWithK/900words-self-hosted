// R1's player-visible contract: a streak is a pencil number on Casey himself,
// and the Home encouragement reads from completed local days, not app opens.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4272)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const failed = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed.push(name)
}

const localKey = (offset) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

await page.addInitScript((days) => {
  localStorage.setItem('cluecab-streak-v1', JSON.stringify({ state: { completedDays: days }, version: 1 }))
}, { [localKey(0)]: 2, [localKey(1)]: 1, [localKey(2)]: 1 })

try {
  await page.goto(`${preview.base}?mock=1&howto=0`)
  await page.waitForSelector('.home-screen')
  check('Casey wears the completed-day streak as a pencil number',
    (await page.locator('.cluey-streak-number').textContent())?.trim() === '3')
  // The bubble stopped speaking the streak when the momentum line moved to a
  // general encouragement. The sticker above is where the number lives now,
  // and the check above is the one that reads it; this one pins the replacement
  // so the band is still asserted to say something.
  const bubble = (await page.locator('.cluey-bubble').innerText()).trim()
  check('and the bubble beside her carries the steady-practice encouragement',
    /A little Danish at a time adds up\./.test(bubble), bubble)
  const layout = await page.evaluate(() => ({ document: document.documentElement.scrollHeight, viewport: innerHeight }))
  check('the streak Home keeps the phone document fixed', layout.document <= layout.viewport + 1, `${layout.document}/${layout.viewport}`)
} catch (error) {
  console.log('STREAK DRIVE FAILED:', error.message)
  failed.push('streak drive threw')
} finally {
  await browser.close()
  preview.stop()
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nSTREAK DRIVE OK')
if (failed.length) process.exitCode = 1
