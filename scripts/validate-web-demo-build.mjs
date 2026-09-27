// The website demo's own publication gate, run after SEC3/SEC4 on
// dist-web-demo/. The demo is served from 900words.app/play/, so beyond the
// app's leak checks it must also prove it is a web page and not an app:
//   - no service worker, workbox runtime, web manifest or source map;
//   - exactly the web-demo audience marker, and no other audience's;
//   - never the app's Casey Worker host;
//   - audio is exactly the allowlist (scripts/web-demo-assets.mjs);
//   - the whole folder stays under a size budget.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { webDemoAssetList } from './web-demo-assets.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const BUDGET_BYTES = 8 * 1024 * 1024
const TEXT = new Set(['.js', '.html', '.css', '.json', '.txt'])

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

export function inspectWebDemoBuild(dist) {
  const violations = []
  if (!existsSync(dist)) return { violations: [`${dist} does not exist; run npm run build:web-demo`], files: 0, bytes: 0 }
  const files = walk(dist)
  const rel = (path) => relative(dist, path).split('\\').join('/')
  let bytes = 0
  let text = ''
  for (const path of files) {
    const name = rel(path)
    bytes += statSync(path).size
    if (/\.map$/.test(name)) violations.push(`${name}: source map`)
    if (/(^|\/)(sw|service-worker)\.js$/.test(name) || /workbox-/.test(name)) violations.push(`${name}: service worker`)
    if (/manifest\.webmanifest$/.test(name)) violations.push(`${name}: web app manifest`)
    if (TEXT.has(extname(name))) text += `\n${readFileSync(path, 'utf8')}`
  }
  if (/sourceMappingURL=/.test(text)) violations.push('a file references a source map')
  if (/registerSW|navigator\.serviceWorker\.register\(/.test(text)) violations.push('the bundle registers a service worker')
  if (!text.includes('__900WORDS_BUILD_AUDIENCE__:web-demo')) violations.push('missing the web-demo audience marker')
  for (const other of ['normal', 'feedback', 'developer', 'open-source']) {
    if (text.includes(`__900WORDS_BUILD_AUDIENCE__:${other}`)) violations.push(`contains the ${other} audience marker`)
  }
  if (text.includes('cluecabulary-proxy')) violations.push("names the app's Casey Worker host")

  const shipped = files.map(rel).filter((name) => name.startsWith('audio/')).sort()
  const expected = webDemoAssetList().filter((name) => name.startsWith('audio/')).sort()
  const extra = shipped.filter((name) => !expected.includes(name))
  const missing = expected.filter((name) => !shipped.includes(name))
  if (extra.length) violations.push(`audio outside the allowlist: ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? ` (+${extra.length - 8})` : ''}`)
  if (missing.length) violations.push(`allowlisted audio missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` (+${missing.length - 8})` : ''}`)
  if (bytes > BUDGET_BYTES) violations.push(`the demo is ${(bytes / 1e6).toFixed(2)} MB, over its ${(BUDGET_BYTES / 1e6).toFixed(1)} MB budget`)
  return { violations, files: files.length, bytes }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
if (invoked) {
  const result = inspectWebDemoBuild(join(ROOT, process.argv[2] ?? 'dist-web-demo'))
  if (result.violations.length) {
    console.error('Web demo build failed its publication gate:')
    for (const violation of result.violations) console.error(`  ${violation}`)
    process.exit(1)
  }
  console.log(`Web demo build: ${result.files} files, ${(result.bytes / 1e6).toFixed(2)} MB, no service worker, no maps, audio exactly the allowlist`)
}
