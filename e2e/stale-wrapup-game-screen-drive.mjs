// A directly injected in-memory retired mode must leave the mounted board
// once, without briefly exposing the old packing surface or mutating durable
// round evidence. This deliberately uses Vite's source server: importing the
// two Zustand modules below then addresses the same module instances that
// mounted the application, rather than a second copy from a preview bundle.
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const port = 4214 + OFFSET
const browserPath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const portFree = () => new Promise((done) => {
  const probe = createServer()
  probe.once('error', () => done(false))
  probe.once('listening', () => probe.close(() => done(true)))
  probe.listen(port, '127.0.0.1')
})

if (!(await portFree())) throw new Error(`port ${port} is already held`)
const localVite = resolve(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const sharedVite = resolve(ROOT, '..', '..', '..', 'node_modules', 'vite', 'bin', 'vite.js')
const vite = existsSync(localVite) ? localVite : sharedVite
const dev = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: ROOT, stdio: 'ignore',
})
const base = `http://127.0.0.1:${port}/ClueCabulary/`
const deadline = Date.now() + 20_000
while (Date.now() < deadline) {
  try {
    if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) break
  } catch { /* wait for Vite */ }
  await sleep(200)
}
if (Date.now() >= deadline) {
  dev.kill()
  throw new Error('Vite source server did not answer')
}
console.log(`source server ready on ${port}`)

const browser = await chromium.launch({ executablePath: browserPath })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
page.on('pageerror', error => failures.push(`page error: ${error.message}`))
page.on('console', message => {
  if (message.type() === 'error') console.log(`browser error: ${message.text()}`)
})
page.on('response', response => {
  if (response.status() >= 400 || response.url().includes('/src/main')) {
    console.log(`browser response: ${response.status()} ${response.url()}`)
  }
})

try {
  // Vite's HMR socket and transformed source modules intentionally keep the
  // document loading; commit the navigation, then wait for the mounted board.
  await page.goto(`${base}?mock=1&howto=0&first=player`, { waitUntil: 'commit', timeout: 15_000 })
  await page.waitForSelector('.home-screen', { timeout: 45_000 })
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid', { timeout: 15_000 })
  const fixture = await page.evaluate(async () => {
    const [{ useGame }, { useUi }] = await Promise.all([
      import('/ClueCabulary/src/stores/gameStore.ts'), import('/ClueCabulary/src/stores/uiStore.ts'),
    ])
    let redirects = 0
    window.__staleWrapupRedirects = 0
    useUi.subscribe((next, previous) => {
      if (previous.screen === 'game' && next.screen === 'home') {
        redirects += 1
        window.__staleWrapupRedirects = redirects
      }
    })
    // This is the direct in-memory state that persistence recovery normally
    // retires before GameScreen can see it. Snapshot only after injection so
    // the assertion measures the mounted guard, not fixture setup.
    useGame.setState({ mode: 'wrapup' })
    const bytes = () => ({
      game: localStorage.getItem('cluecab-game-v1'),
      sessions: localStorage.getItem('cluecab-progression-sessions-v1'),
      ledger: localStorage.getItem('cluecab-settlement-v1'),
    })
    return { afterFixture: bytes() }
  })
  await page.waitForSelector('.home-screen')
  await page.waitForTimeout(250)
  const result = await page.evaluate(async () => {
    const { useUi } = await import('/ClueCabulary/src/stores/uiStore.ts')
    const bytes = {
      game: localStorage.getItem('cluecab-game-v1'),
      sessions: localStorage.getItem('cluecab-progression-sessions-v1'),
      ledger: localStorage.getItem('cluecab-settlement-v1'),
    }
    return { bytes, screen: useUi.getState().screen, redirects: window.__staleWrapupRedirects }
  })
  const redirectCount = result.redirects
  check('mounted stale wrap-up redirects Home exactly once without a loop', result.screen === 'home' && redirectCount === 1, `${result.screen}/${redirectCount}`)
  check('mounted stale wrap-up renders neither board nor packing UI',
    await page.locator('.board-grid, .packing-dock, .packing-screen').count() === 0,
    await page.locator('body').innerText(),
  )
  check('mounted stale wrap-up redirect leaves game, sessions and ledger bytes unchanged',
    JSON.stringify(result.bytes) === JSON.stringify(fixture.afterFixture),
  )
} finally {
  await browser.close()
  dev.kill()
}

console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nSTALE WRAP-UP GAME SCREEN DRIVE OK')
if (failures.length) process.exitCode = 1
