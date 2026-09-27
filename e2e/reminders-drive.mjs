// R2's web safety contract: only the native iPhone bridge may ask Apple for
// notification permission. The PWA explains the boundary and never creates a
// pretend opt-in that could mislead a player.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4293)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const failed = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed.push(name)
}

try {
  await page.goto(`${preview.base}?mock=1&howto=0`)
  await page.waitForSelector('.home-screen')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForSelector('.settings-screen')

  const reminder = page.locator('.reminders-section')
  check('Settings explains that reminders are available in the iPhone app',
    (await reminder.innerText()).includes('Available in the 900words iPhone app.'))
  check('the web has no opt-in control that could claim notification consent',
    await page.locator('.daily-reminder-opt-in').count() === 0)
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}').state ?? {})
  check('visiting Settings does not persist reminder consent on the web', persisted.dailyReminders !== true)
} catch (error) {
  console.log('REMINDERS DRIVE FAILED:', error.message)
  failed.push('reminders drive threw')
} finally {
  await browser.close()
  preview.stop()
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nREMINDERS DRIVE OK')
if (failed.length) process.exitCode = 1
