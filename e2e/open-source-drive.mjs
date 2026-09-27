// The open-source build with the player's own AI key (owner, 2026-09-27):
// no Worker at all, the key typed into Settings, the app talking straight to
// an OpenAI-compatible service (a fake one here) through Casey's own logic.
//
// Opt-in (scripts/run-drives.mjs): it builds its own bundle, dist-open-source.
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import { startFakeOllama } from './fake-ollama.mjs'
import { startPreview } from './preview-server.mjs'
import { createOnboardingFlow } from './_onboarding-flow.mjs'

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
  // Desktop Gemma (owner, 2026-09-27): offered on the computer, with an
  // offline switch beside the key. Whether she can run depends on the
  // browser's WebGPU, which a headless Chromium may or may not have, so the
  // panel must show either her download or what she needs, never nothing.
  check('the desktop self-build offers Gemma on this computer',
    (await section.locator('label.field-row', { hasText: 'Gemma on this computer' }).count()) === 1)
  check('and an offline switch beside the key', (await page.getByTestId('oss-offline-mode').count()) === 1)
  await section.locator('input[value="gemma4-e4b"]').check()
  const gemmaPanel = page.getByTestId('own-gemma-fields')
  await gemmaPanel.waitFor()
  await page.waitForTimeout(500)
  const gemmaNeeds = await gemmaPanel.getByTestId('gemma-unavailable').count()
  const gemmaDownload = await gemmaPanel.getByRole('button', { name: 'Download offline Casey' }).count()
  check('choosing her shows her download, or that she needs WebGPU', gemmaNeeds + gemmaDownload === 1,
    gemmaNeeds ? 'no WebGPU in this browser' : 'download offered')
  await section.locator('input[value="own-key"]').check()
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

  // A brand-new self-build, set up nothing, rides the intro. Its practice
  // round already needs Casey's AI for the player's own clue, and during the
  // intro the error banner's "Casey settings" used to do nothing (owner,
  // 2026-09-27): the intro replaced every screen, Settings included.
  const intro = await browser.newContext({ viewport: { width: 360, height: 640 } })
  await intro.addInitScript(() => {
    // English, and the intro's lessons already seen: this is about the
    // round, and a lesson overlay would only stand in the way of its taps.
    if (!localStorage.getItem('cluecab-ui-language')) localStorage.setItem('cluecab-ui-language', 'en')
    if (!localStorage.getItem('cluecab-onboard-lessons-v1')) {
      localStorage.setItem('cluecab-onboard-lessons-v1', JSON.stringify({ translation: 'done', wheel: 'done', result: 'done', home: 'done' }))
    }
  })
  const fresh = await intro.newPage()
  fresh.on('pageerror', (e) => errors.push(`intro: ${e.message}`))
  await fresh.goto(preview.base)
  const flow = createOnboardingFlow(fresh)
  await flow.ticketToHome('Denmark')
  await flow.homeToTutorial()
  const practice = () => fresh.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game ?? null)
  // Casey's two scripted clues and the answers the practice board is built for.
  const answers = { drikke: ['da:vand', 'da:kaffe', 'da:mælk'], hjem: ['da:hus'] }
  let phase = null
  for (let i = 0; i < 200 && phase !== 'playerClueInput'; i++) {
    await fresh.waitForTimeout(100)
    const game = await practice()
    phase = game?.phase ?? null
    if (phase !== 'playerGuessing') continue
    const clue = game.clueHistory.at(-1)
    const done = new Set(clue.guesses.map((guess) => guess.wordId))
    const wordId = (answers[clue.text] ?? []).find((id) => !done.has(id) && game.reveals[id].kind === 'hidden')
    if (!wordId) throw new Error(`the practice round asked for «${clue.text}», which this drive has no answer for`)
    const word = game.words.find((entry) => entry.wordId === wordId).da
    await fresh.locator(`.word-card:has(.card-word:text-is("${word}"))`).click()
    await fresh.locator('.guess-confirm .btn-primary').click()
    await fresh.waitForFunction(
      ({ clues, guesses }) => {
        const state = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
        return state?.clueHistory?.length > clues || state?.clueHistory?.[clues - 1]?.guesses?.length > guesses
      },
      { clues: game.clueHistory.length, guesses: clue.guesses.length },
    )
  }
  check('a fresh self-build reaches its own first clue in the practice round', phase === 'playerClueInput', String(phase))
  await fresh.locator('.clue-input input[aria-label^="Your one-word clue"]').fill('spise')
  if (Number(await fresh.locator('.stepper-value').innerText()) < 2) await fresh.locator('[aria-label="more words"]').click()
  await fresh.locator('.clue-input .btn-primary').click()
  const banner = fresh.locator('.error-banner')
  await banner.waitFor({ timeout: 20000 })
  check('with no AI yet, Casey says to set her up', (await banner.textContent()).includes('Set up Casey in Settings'))
  const cluesBefore = (await practice()).clueHistory.length

  await banner.getByRole('button', { name: 'Casey settings' }).click()
  const setUp = fresh.getByTestId('own-casey-settings')
  const reached = await setUp.waitFor({ timeout: 5000 }).then(() => true, () => false)
  check('"Casey settings" opens Settings in the middle of the intro', reached)
  if (reached) {
    const introFields = fresh.getByTestId('own-key-fields')
    await introFields.locator('input[type="url"]').fill(fake.baseUrl)
    await introFields.locator('input[type="text"]').fill(MODEL)
    await introFields.locator('input[type="password"]').fill(KEY)
    await fresh.locator('.settings-screen .screen-header .icon-btn').click()
    await fresh.locator('.tutorial-game .board-grid').waitFor({ timeout: 5000 })
    check('and its back arrow returns to the same practice round',
      (await practice()).clueHistory.length === cluesBefore && (await fresh.locator('.error-banner').count()) === 1)
    const asked = fake.received.length
    await fresh.locator('.error-banner').getByRole('button', { name: 'Retry' }).click()
    const answered = await fresh.waitForFunction(
      (clues) => {
        const state = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
        return (state?.clueHistory?.[clues - 1]?.guesses?.length ?? 0) > 0
      },
      cluesBefore,
      { timeout: 30000 },
    ).then(() => true, () => false)
    check('Retry then plays Casey’s guess with the key just added', answered && (await fresh.locator('.error-banner').count()) === 0,
      `service asked ${fake.received.length - asked} time(s)`)
  }
  const introErrors = errors.filter((message) => message.startsWith('intro:'))
  check('and the intro threw nothing', introErrors.length === 0, introErrors.join(' | '))
  await intro.close()
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
