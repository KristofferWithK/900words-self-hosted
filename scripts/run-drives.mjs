// Run the browser drives — the checks that open the real built app in a real
// Chromium and use it the way a thumb does.
//
// It exists because the alternative was a seventeen-name bash loop typed by
// hand every time, which is miserable on a phone and easy to get subtly wrong.
// Two mistakes in particular it makes impossible:
//
//   1. Forgetting `npm run build`. The drives serve `dist/` through
//      `vite preview`, so an unbuilt tree silently tests the PREVIOUS build.
//      That has already produced one confidently-wrong measurement in this
//      repo: a change was reported as not working when the change simply was
//      not in the bundle. `--no-build` is there for when you know better.
//   2. Forgetting CHROMIUM_PATH, which half the drives default differently on.
//
// Usage:
//   node scripts/run-drives.mjs                 every drive
//   node scripts/run-drives.mjs repeat layout   just those
//   node scripts/run-drives.mjs --no-build      trust the current dist/
//   node scripts/run-drives.mjs --list          names only
//   node scripts/run-drives.mjs --jobs 6        six drives at once
//   node scripts/run-drives.mjs --jobs 1        one after another, as before
//   node scripts/run-drives.mjs --verbose       print every drive's whole log
//
// --jobs N (default min(6, cpus/3)). Most of a drive's time is spent waiting
// on timers, so several run side by side. Each concurrent slot gets its own
// DRIVE_PORT_OFFSET: slot k sits one port SPAN above slot k-1, where the span
// covers every port literal in e2e/ (4173..5311 today), so two slots can never
// meet on a port. An offset that would land any of those ports on a browser
// "bad port" (fetch refuses 6000, 6665-6669, 10080 …) or on a Windows excluded
// port range is skipped. The caller's own DRIVE_PORT_OFFSET is the base.
// Drives in SERIAL below touch something the others share and run alone,
// one at a time, after the parallel batch. Each drive's output is buffered
// and printed as one block when it finishes, so logs never interleave.
// `--jobs 1` keeps the old behaviour exactly: same order, same environment.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Drives NOT run by default, and why — a default that quietly skipped things
 * without saying so would be worse than no default.
 *
 *   live    needs a deployed Casey Worker and spends real model calls
 *
 * `proxy` is in the list anyway because it runs against a local stand-in; only
 * `live` and `engine-probe` are genuinely opt-in. Everything else here is not
 * a drive at all — `map-preview`, `ollama-probe`, `home-space-probe`,
 * `composer-probe`, `dock-probe` and `map-budget-probe` measure and print,
 * and a PASS from something that asserts nothing is worth less than no line.
 *
 * `engine-probe` is BOTH: it prints rather than asserts, AND it pays for every
 * round, which is why it refuses to start without a Casey Worker instead of
 * falling back to something free and calling the result a measurement (E4).
 */
const NOT_DRIVES = new Set([
  'fake-ollama.mjs',
  'preview-server.mjs',
  'worker-runtime.mjs',
  'round-guidance.mjs',
  'map-stops.mjs',
])
const OPT_IN = new Set([
  // Review harnesses retained for explicit evidence work: the source variant
  // needs a live Vite server, and the built twin still seeds the retired
  // whole-wrap-up fixture. Current Guide/receipt coverage is in the maintained
  // City 1 acceptance drives.
  'city1-review',
  'city1-review-built',
  'live',
  'engine-probe',
  // Real model calls per row on the local Ollama daemon, hours per sweep.
  'guess-bench',
  'map-preview',
  'ollama-probe',
  'home-space-probe',
  'composer-probe',
  'dock-probe',
  'map-budget-probe',
  // Historical, one-off visual/measurement probes and City 2+ route exercises.
  // Keep them runnable by name; the normal City 1 release gate must exercise
  // the maintained successor paths instead.
  'endgame-rules-probe',
  'free-type-probe',
  'german-preview',
  'journey',
  'lastchance-polish-probe',
  'measure-sentence-layout',
  'packing-pills-probe',
  'revisit',
  'ticket',
  'train-grammar',
  'wheel-corrections-probe',
  'wheel-midspin-shots',
  // These assert explicitly built release flavors. A normal `npm run drives`
  // must not accidentally run either one against the normal bundle.
  'feedback-access',
  'developer-access',
  // Builds and serves its own website bundle (dist-web-demo) and website Casey.
  'web-demo',
  // Builds and serves its own open-source bundle (dist-open-source) against a fake AI service.
  'open-source',
  // Timing is machine-dependent: compare base and branch on one machine.
  'latency-probe',
  // One-off timing probe (2026-09-18): asserts almost nothing and sends its
  // opening request to the LIVE production Worker. Run it by name.
  'opening-timing-probe',
])

/**
 * Drives that cannot share the machine with other drives, and why. With
 * --jobs above 1 they run alone, one at a time, after the parallel batch.
 * With --jobs 1 everything is alone anyway and the order is unchanged.
 */
const SERIAL = new Map([
  ['offline', 'deletes dist/audio and copies it back, and every other drive serves dist/'],
  ['update', 'rewrites dist/sw.js mid-run, and every other drive serves dist/'],
  // Passes alone; timed out twice in three --jobs 4 runs (2026-10-04).
  ['stale-wrapup-game-screen', 'cold-loads the whole app from a Vite dev server; misses its 45 s wait beside other drives'],
  // Failed 3 of 9 parallel runs, 0 of 5 alone right after (once alone under other load).
  ['casey-justification', "pauses the page clock at Node's wall time; on a busy CPU the page is already past it"],
  ['journey', 'writes dist/audio/da/chapter and dist/chapter-timings.da.json'],
  ['web-demo', 'builds dist-web-demo itself and bundles website Casey with wrangler'],
  ['engine-probe', 'holds fixed ports 4199/4200 that ignore DRIVE_PORT_OFFSET'],
  ['city1-review', 'talks to a fixed live Vite listener on port 5184'],
  ['measure-sentence-layout', 'talks to a fixed preview on port 4183'],
  ['latency-probe', 'a timing measurement; other drives on the CPU change the numbers'],
  ['opening-timing-probe', 'a timing measurement; other drives on the CPU change the numbers'],
  ['guess-bench', 'hours of local Ollama calls; nothing should share that GPU'],
])

const allDrives = readdirSync(resolve(ROOT, 'e2e'))
  .filter((f) => f.endsWith('.mjs') && !NOT_DRIVES.has(f) && !f.startsWith('_'))
  .map((f) => f.replace(/-drive\.mjs$|\.mjs$/, ''))
  .sort()

const argv = process.argv.slice(2)
const noBuild = argv.includes('--no-build')
const verbose = argv.includes('--verbose')
let jobs = Math.max(1, Math.min(6, Math.floor(availableParallelism() / 3)))
const wanted = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--jobs' || a.startsWith('--jobs=')) {
    const value = a === '--jobs' ? argv[++i] : a.slice('--jobs='.length)
    jobs = Number(value)
    if (!Number.isInteger(jobs) || jobs < 1) {
      console.error(`--jobs wants a whole number of at least 1, not ${value}`)
      process.exit(2)
    }
  } else if (!a.startsWith('--')) {
    wanted.push(a)
  }
}

if (argv.includes('--list')) {
  console.log(
    allDrives
      .map((d) => [d, OPT_IN.has(d) && 'opt-in', SERIAL.has(d) && 'serial'].filter(Boolean))
      .map(([d, ...tags]) => (tags.length ? `${d} (${tags.join(', ')})` : d))
      .join('\n'),
  )
  process.exit(0)
}

const fileFor = (name) => {
  for (const candidate of [`e2e/${name}-drive.mjs`, `e2e/${name}.mjs`]) {
    if (existsSync(resolve(ROOT, candidate))) return candidate
  }
  return null
}

const selected = wanted.length ? wanted : allDrives.filter((d) => !OPT_IN.has(d))
const missing = selected.filter((d) => !fileFor(d))
if (missing.length) {
  console.error(`No such drive: ${missing.join(', ')}\nTry --list.`)
  process.exit(2)
}

const run = (cmd, args, env = {}, shell = false) =>
  new Promise((done) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, shell })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    p.on('close', (code) => done({ code, out }))
  })

// The pre-installed browser this image ships. Taken from the environment when
// it is set, so a machine that keeps Chromium elsewhere still works.
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ??
  ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) =>
    existsSync(p),
  )

if (!CHROMIUM_PATH) {
  console.error(
    'No Chromium found. Set CHROMIUM_PATH, or check PLAYWRIGHT_BROWSERS_PATH — do not run\n' +
      '`playwright install`, this image ships the browsers already.',
  )
  process.exit(2)
}

// Screenshots the drives write, kept out of the repo root where they used to
// pile up. Gitignored either way, but a directory is tidier than fifteen loose
// PNGs and makes them easy to look at afterwards.
const SHOT_DIR = process.env.SHOT_DIR ?? resolve(ROOT, 'e2e-shots')
mkdirSync(SHOT_DIR, { recursive: true })

if (!noBuild) {
  process.stdout.write('building… ')
  // npm is npm.cmd on Windows, which spawn() cannot exec without a shell.
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const built = await run(npm, ['run', 'build'], {}, process.platform === 'win32')
  if (built.code !== 0) {
    console.log('FAILED\n')
    console.log(built.out.split('\n').slice(-30).join('\n'))
    process.exit(1)
  }
  console.log('ok')
} else {
  console.log('skipping the build — dist/ is whatever it was')
}

/**
 * Ports the browser itself refuses to fetch from (the fetch standard's "bad
 * port" list, which Chromium enforces). A drive whose preview lands on one
 * fails with net::ERR_UNSAFE_PORT — an offset of 1500 once put
 * integration-recovery's 4500 on 6000.
 */
const BAD_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
  6669, 6679, 6697, 10080,
])

/** Windows keeps port ranges for Hyper-V and friends; binding inside one fails. */
function excludedPortRanges() {
  if (process.platform !== 'win32') return []
  try {
    const text = execFileSync('netsh', ['interface', 'ipv4', 'show', 'excludedportrange', 'protocol=tcp'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return [...text.matchAll(/^\s*(\d+)\s+(\d+)/gm)].map((m) => [Number(m[1]), Number(m[2])])
  } catch {
    return []
  }
}

/**
 * Every port number the drives might open before their offset: each 41xx-59xx
 * literal in e2e/. A few are timeouts rather than ports; counting them only
 * makes the bad-port check stricter, never wrong.
 */
function drivePortFootprint() {
  const ports = new Set()
  for (const file of readdirSync(resolve(ROOT, 'e2e')).filter((f) => f.endsWith('.mjs'))) {
    const text = readFileSync(resolve(ROOT, 'e2e', file), 'utf8')
    for (const m of text.matchAll(/\b(4[1-9]\d\d|5\d\d\d)\b/g)) ports.add(Number(m[1]))
  }
  return [...ports]
}

/**
 * One DRIVE_PORT_OFFSET per slot. Slots sit at least one footprint span apart,
 * so no port of one slot can equal a port of another; an offset that would put
 * any footprint port on a bad or excluded port moves up by 100 until it does not.
 */
function slotOffsets(count, base) {
  const footprint = drivePortFootprint()
  const low = Math.min(...footprint)
  const high = Math.max(...footprint)
  const span = Math.ceil((high - low + 1) / 100) * 100
  const excluded = excludedPortRanges()
  const clean = (offset) =>
    footprint.every((p) => {
      const port = p + offset
      return !BAD_PORTS.has(port) && !excluded.some(([from, to]) => port >= from && port <= to)
    })
  const offsets = []
  let next = base
  while (offsets.length < count) {
    while (!clean(next)) next += 100
    if (high + next > 49151) {
      console.error(`--jobs ${count} needs ports above 49151 from base ${base}; ask for fewer jobs`)
      process.exit(2)
    }
    offsets.push(next)
    next += span
  }
  return offsets
}

// Each drive's last time, so a parallel run can start the slow ones first.
const TIMES_FILE = resolve(SHOT_DIR, 'drive-times.json')
function readTimes() {
  try {
    return JSON.parse(readFileSync(TIMES_FILE, 'utf8'))
  } catch {
    return {}
  }
}
function writeTimes(times) {
  try {
    writeFileSync(TIMES_FILE, `${JSON.stringify(times, null, 2)}\n`)
  } catch {
    // Only a scheduling hint; never fail a run over it.
  }
}

const failed = []
const started = Date.now()

/** Print one drive's whole log as a block, every line tagged with its name. */
const printBlock = (name, out) => {
  const lines = out.replace(/\s+$/, '').split(/\r?\n/)
  console.log(lines.map((line) => `${name} | ${line}`).join('\n'))
}

// How long each drive took last time (kept in SHOT_DIR, never in the repo).
const times = readTimes()

if (jobs === 1) {
  for (const name of selected) {
    process.stdout.write(`${name.padEnd(14)} `)
    const at = Date.now()
    const { code, out } = await run('node', [fileFor(name)], { CHROMIUM_PATH, SHOT_DIR })
    const secs = ((Date.now() - at) / 1000).toFixed(0)
    if (code === 0) {
      console.log(`PASS  ${secs}s`)
    } else {
      console.log(`FAIL  ${secs}s`)
      failed.push({ name, out })
    }
    if (verbose) printBlock(name, out)
    times[name] = Math.round((Date.now() - at) / 1000)
  }
  writeTimes(times)
} else {
  const offsets = slotOffsets(jobs, Number(process.env.DRIVE_PORT_OFFSET ?? 0))
  const serial = selected.filter((d) => SERIAL.has(d))
  // Longest first, from the last run's times, so a slow drive does not start
  // last and hold the whole run up. Unknown drives go first: they might be slow.
  const parallel = selected
    .filter((d) => !SERIAL.has(d))
    .sort((a, b) => (times[b] ?? Infinity) - (times[a] ?? Infinity) || a.localeCompare(b))
  const width = Math.max(14, ...selected.map((d) => d.length))
  console.log(
    `${parallel.length} drive(s) on ${Math.min(jobs, parallel.length)} slot(s), port offsets ` +
      `${offsets.slice(0, Math.min(jobs, Math.max(1, parallel.length))).join(', ')}` +
      (serial.length ? `; then alone: ${serial.join(', ')}` : ''),
  )

  const runOne = async (name, offset) => {
    const at = Date.now()
    const { code, out } = await run('node', [fileFor(name)], {
      CHROMIUM_PATH,
      SHOT_DIR,
      DRIVE_PORT_OFFSET: String(offset),
    })
    const secs = (Date.now() - at) / 1000
    times[name] = Math.round(secs)
    console.log(`${name.padEnd(width)} ${code === 0 ? 'PASS' : 'FAIL'}  ${secs.toFixed(0)}s`)
    if (verbose) printBlock(name, out)
    if (code !== 0) failed.push({ name, out })
  }

  const queue = [...parallel]
  await Promise.all(
    offsets.slice(0, Math.min(jobs, parallel.length)).map(async (offset) => {
      while (queue.length) await runOne(queue.shift(), offset)
    }),
  )
  for (const name of serial) {
    console.log(`(alone: ${SERIAL.get(name)})`)
    await runOne(name, offsets[0])
  }
  writeTimes(times)
}

console.log(`\n${selected.length - failed.length}/${selected.length} in ${((Date.now() - started) / 1000).toFixed(0)}s`)

for (const f of failed) {
  console.log(`\n===== ${f.name} =====`)
  // The tail, not the whole log: a drive that fails prints its own OK/FAIL
  // lines and the checks that matter are at the bottom.
  console.log(f.out.split('\n').slice(-40).join('\n'))
}

process.exit(failed.length ? 1 : 0)
