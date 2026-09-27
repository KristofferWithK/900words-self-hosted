// Build the website's playable intro (900words.app/play/) into dist-web-demo/.
//
//   WEB_CASEY_URL=https://casey.900words.app/v1 TURNSTILE_SITE_KEY=<public key> \
//     [APP_STORE_URL=https://apps.apple.com/...] npm run build:web-demo
//
// The same checks as `npm run build`, pointed at the demo's folder, plus the
// demo's own publication gate. Cross-platform: env is passed in code, so the
// command works in PowerShell as well as a POSIX shell.
import { spawnSync } from 'node:child_process'

const env = { ...process.env, BUILD_AUDIENCE: 'web-demo' }
for (const name of ['WEB_CASEY_URL', 'TURNSTILE_SITE_KEY']) {
  if (!env[name]) {
    console.error(`build:web-demo needs ${name} (see scripts/build-web-demo.mjs)`)
    process.exit(1)
  }
}

const steps = [
  ['npx', ['tsc', '-b']],
  ['node', ['scripts/generate-clue-lexicon.mjs', '--check']],
  ['node', ['scripts/generate-deal-index.mjs', '--check']],
  ['node', ['scripts/generate-association-index.mjs', '--check']],
  ['npx', ['vite', 'build']],
  ['node', ['scripts/validate-client-boundary.mjs', '--dist', 'dist-web-demo']],
  ['node', ['scripts/validate-release-package.mjs', 'dist-web-demo']],
  ['node', ['scripts/validate-web-demo-build.mjs', 'dist-web-demo']],
]
for (const [command, args] of steps) {
  const run = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
  if (run.status !== 0) process.exit(run.status ?? 1)
}
