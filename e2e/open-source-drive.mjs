// The open-source build with the player's own AI key (owner, 2026-09-27):
// no Worker at all, the key typed into Settings, the app talking straight to
// an OpenAI-compatible service (a fake one here) through Casey's own logic.
//
// Opt-in (scripts/run-drives.mjs): it builds its own bundle, dist-open-source.
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import { startFakeOllama } from './fake-ollama.mjs'
import { startPreview } from './preview-server.mjs'

const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const KEY = 'sk-drive-test-0123456789'
const MODEL = 'drive-model'

if (!process.argv.includes('--no-build')) {
  const build = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-open-source'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, BUILD_AUDIENCE: 'open-source', CAP_BUILD: '', SELF_HOSTED_CASEY_URL: '' },
  })
  if (build.status !== 0) throw new Error('open-source build failed')
  // The package gates `npm run build` runs after vite, so a self-builder's
  // build cannot fail a check this drive never ran.
  for (const gate of [
    ['scripts/validate-client-boundary.mjs', '--dist', 'dist-open-source'],
    ['scripts/validate-release-package.mjs', 'dist-open-source'],
  ]) {
    const run = spawnSync('node', gate, { stdio: 'inherit', env: { ...process.env, BUILD_AUDIENCE: 'open-source', CAP_BUILD: '' } })
    if (run.status !== 0) throw new Error(`${gate[0]} refused the open-source build`)
  }
}

process.env.BUILD_AUDIENCE = 'open-source'
process.env.SELF_HOSTED_CASEY_URL = ''
process.env.PREVIEW_DIST = 'dist-open-source'
const preview = await startPreview(4198)
const fake = await startFakeOllama(4398 + OFFSET, { auto: true })

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${preview.base}?howto=0`)
  await page.waitForSelector('.home-screen')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForSelector('.settings-screen')

  const section = page.getByTestId('own-casey-settings')
  await section.waitFor()
  check('a self-built 900words asks where Casey’s AI comes from', (await section.count()) === 1)
  check('and nowhere else: no store-build brain switch, no offline fallback from 900words’ server',
    (await page.locator('.casey-brain-toggle').count()) === 0 &&
      (await page.getByTestId('offline-mode-settings').count()) === 0)
  check('with no Casey server, it offers no usage counters or data sharing',
    (await page.locator('.usage-stats-toggle').count()) === 0)

  // Out of the box on the web (no Gemma there): the player's own key, already
  // pointed at the App Store's service and model, so only the key is missing.
  check('a fresh web self-build starts on "your own AI key"',
    await section.locator('input[value="own-key"]').isChecked())
  check('Gemma is not offered where the build cannot run her',
    (await section.locator('input[value="gemma4-e4b"]').count()) === 0)
  const fields = page.getByTestId('own-key-fields')
  await fields.waitFor()
  const [address, model, key] = [fields.locator('input[type="url"]'), fields.locator('input[type="text"]'), fields.locator('input[type="password"]')]
  check('pre-filled with the App Store’s service and model',
    (await address.inputValue()) === 'https://ollama.com/v1' && (await model.inputValue()) === 'gpt-oss:120b',
    `${await address.inputValue()} / ${await model.inputValue()}`)
  check('and no Test until a key is entered',
    await section.locator('[data-action="test-own-casey"]').isDisabled())
  await address.fill(fake.baseUrl)
  await model.fill(MODEL)
  await key.fill(KEY)
  check('the key field hides what is typed', (await key.getAttribute('type')) === 'password')

  const before = fake.received.length
  await section.locator('[data-action="test-own-casey"]').click()
  await section.locator('.test-ok, .test-fail').first().waitFor({ timeout: 20000 })
  const ok = await section.locator('.test-ok').count()
  check('Test connection reaches the player’s own service and says so', ok === 1,
    ok ? '' : await section.locator('.test-fail').textContent())

  const sent = fake.received.slice(before)
  check('the request carried the player’s key', sent.some((r) => r.auth === `Bearer ${KEY}`))
  check('and the model they named', sent.some((r) => JSON.parse(r.raw).model === MODEL))
  check('and asked for JSON', sent.some((r) => JSON.parse(r.raw).response_format?.type === 'json_object'))

  const stored = await page.evaluate(() => ({
    own: localStorage.getItem('cluecab-own-ai-v1') ?? '',
    settings: localStorage.getItem('cluecab-settings-v1') ?? '',
  }))
  check('the key is kept in its own slot on this device', stored.own.includes(KEY))
  check('and never in the settings blob a backup could carry', !stored.settings.includes(KEY))
  check('the page threw nothing', errors.length === 0, errors.join(' | '))
  check('the document still fits the phone', await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1))
} catch (error) {
  console.log('OPEN-SOURCE DRIVE FAILED:', error.message)
  fail.push('open-source drive threw')
} finally {
  await browser.close()
  await fake.stop()
  preview.stop()
}

console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nOPEN-SOURCE DRIVE OK')
if (fail.length) process.exitCode = 1
