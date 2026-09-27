import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, sep } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every drive's port, shifted by one number, so two checkouts of this repo can
 * run drives at the same time instead of silently measuring each other.
 *
 * The drives hold fixed ports (4173..4200) and that is fine for one tree. It
 * is not fine for two: a second worktree running the same drive finds the port
 * held, and — before the guard below existed — quietly talked to the other
 * tree's build. Three measurements in one session were wrong that way, each of
 * them a change reported as absent because the bundle serving it belonged to
 * somebody else.
 *
 *   DRIVE_PORT_OFFSET=100 npm run verify
 */
const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
// A focused release-flavor drive can inspect a separately built bundle without
// replacing this checkout's dist/. Ordinary drives leave PREVIEW_DIST unset and
// keep serving the build the normal runner just made. Read when a preview
// STARTS, not when this module loads: a drive sets it in its own body, after
// its imports have run, and a value captured here was always undefined, so
// such a drive silently served dist/ (found 2026-09-27, open-source-drive).

const VITE_RELATIVE_PATH = ['node_modules', 'vite', 'bin', 'vite.js']

const repositoryRoot = (root) => {
  const gitMarker = resolve(root, '.git')
  if (!existsSync(gitMarker)) return root
  // A linked worktree's .git file points into the shared repository's
  // .git/worktrees directory; that shared repository is the only allowed
  // fallback boundary. A regular checkout's .git directory is the boundary.
  if (existsSync(gitMarker) && !existsSync(resolve(gitMarker, 'HEAD'))) {
    const match = /^gitdir:\s*(.+)$/m.exec(readFileSync(gitMarker, 'utf8'))
    if (match) {
      const gitDir = resolve(root, match[1].trim())
      const marker = `${sep}.git${sep}`
      const gitIndex = gitDir.toLowerCase().indexOf(marker.toLowerCase())
      if (gitIndex >= 0) return gitDir.slice(0, gitIndex)
    }
  }
  return root
}

/** Resolve the checkout's own Vite, or the repository-root shared install. */
export function resolveViteBin(root = ROOT) {
  const boundary = repositoryRoot(root)
  for (const directory of root === boundary ? [root] : [root, boundary]) {
    const candidate = resolve(directory, ...VITE_RELATIVE_PATH)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    `could not find Vite in checkout ${root} or repository root ${boundary}; ` +
      'run npm ci in the checkout or its repository root',
  )
}

/** Whether we can bind it ourselves — asked before spawning, see below. */
const portFree = (port) =>
  new Promise((done) => {
    const probe = createServer()
    probe.once('error', () => done(false))
    probe.once('listening', () => probe.close(() => done(true)))
    probe.listen(port, '127.0.0.1')
  })

/**
 * Start a preview server for one drive and wait until it actually answers.
 *
 * Every drive used to spawn `vite preview --strictPort` and sleep. If something
 * already held the port — an orphan from a drive that crashed before its
 * cleanup ran — vite exited quietly and the drive talked to that stale server
 * instead, serving a build from an hour ago. That failed in ways that looked
 * like app bugs and cost more time than it should have. A port that is not
 * ours is now a loud, immediate failure — genuinely so, since the first
 * version of that guard could still be beaten to the answer by the server it
 * was guarding against. See the check at the top of the function.
 */
export async function startPreview(requestedPort) {
  const port = requestedPort + OFFSET
  // Asked BEFORE spawning, because asking afterwards is a race this lost.
  //
  // The intent below — "a port that is not ours is a loud, immediate failure"
  // — was not what the code did. vite exits on a held port, but the exit event
  // arrives asynchronously, and the first fetch of the loop went out before it
  // did. A server already on the port answered, its body carried this app's
  // own name because it IS this app, and the drive returned happily and measured
  // another checkout's build. That is the exact silent-stale-server failure
  // this file was written to end, surviving inside the fix for it.
  if (!(await portFree(port))) {
    throw new Error(
      `port ${port} is already held, so this drive would measure whoever holds ` +
        `it rather than this build. Wait for them, or run with ` +
        `DRIVE_PORT_OFFSET set to move every drive's port out of the way.`,
    )
  }
  // Spawn vite's bin through the current node — `spawn('npx', …)` is ENOENT on
  // Windows, where npx is npx.cmd and .cmd files need a shell to execute.
  // A linked worktree normally has its own install. The desktop session keeps
  // one shared install at the repository root instead, so a drive must be
  // able to find it without making `npm ci` a prerequisite for every card.
  const viteBin = resolveViteBin()
  // --host 127.0.0.1: on Windows vite's default `localhost` binds ::1 only,
  // while every drive (and the base URL below) talks IPv4.
  const proc = spawn(
    process.execPath,
    [
      viteBin,
      'preview',
      ...(process.env.PREVIEW_DIST ? ['--outDir', process.env.PREVIEW_DIST] : []),
      '--port', String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    {
      cwd: ROOT,
      stdio: 'ignore',
    },
  )

  let exited = false
  proc.on('exit', () => {
    exited = true
  })

  // PREVIEW_BASE: the web demo (BUILD_AUDIENCE=web-demo) is served at /play/.
  const base = `http://127.0.0.1:${port}${process.env.PREVIEW_BASE ?? '/'}`
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(
        `vite preview exited on port ${port} — something else is probably holding it. ` +
          `Check with: pgrep -af '\\.bin/vite'`,
      )
    }
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(1500) })
      // A stale orphan answers too, so insist on a body this build would serve.
      // Matched on the product name, not the retained legacy preview path
      // above, so this check is independent of delivery or repository naming.
      if (res.ok && (await res.text()).includes('900words')) {
        return { proc, base, port, stop: () => proc.kill() }
      }
    } catch {
      // Not up yet.
    }
    await sleep(250)
  }
  proc.kill()
  throw new Error(`preview server on port ${port} never answered`)
}
