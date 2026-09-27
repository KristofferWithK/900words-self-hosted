// The web demo's slice of public/. The app ships ~37 MB of audio; the website
// intro plays two boards, so it gets only those 27 words' clips (plus the
// shared articles, the boards' nouns said with their article, UI sounds and
// icons). Read by vite.config.ts for a
// BUILD_AUDIENCE=web-demo build, and by scripts/validate-web-demo-build.mjs,
// which checks the built audio is exactly this list.
//
// The words come from proxy/data/web-demo-boards.da.json, which
// src/webdemo/demoBoards.test.ts pins to the app's own board sources.
import { cpSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const BOARDS = join(ROOT, 'proxy', 'data', 'web-demo-boards.da.json')
const PHRASES = join(ROOT, 'src', 'data', 'article-phrases.da.json')

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? walk(path) : [path]
      })
    : []

const posix = (path) => relative(PUBLIC, path).split('\\').join('/')

/** Every public/ file the web demo ships, as posix paths relative to public/. */
export function webDemoAssetList() {
  const boards = JSON.parse(readFileSync(BOARDS, 'utf8'))
  const slugs = [...new Set([...boards.practice.slugs, ...boards.firstBoard.slugs])].sort()
  const files = new Set()
  const add = (path) => files.add(posix(path))
  for (const path of walk(join(PUBLIC, 'icons'))) add(path)
  for (const path of walk(join(PUBLIC, 'audio', 'ui'))) add(path)
  for (const path of walk(join(PUBLIC, 'audio', 'da', 'article'))) add(path)
  const missing = []
  // A City 1 noun with its own «en/et + word» performance plays that instead
  // of the article chain (speak.ts articlePhraseAudioUrl), at both speeds.
  // Its file is the article and the word's slug: «et hus» is et-hus.mp3.
  const phrases = new Map(JSON.parse(readFileSync(PHRASES, 'utf8')).words.map((row) => [row.id, row.article]))
  for (const board of [boards.practice, boards.firstBoard]) {
    board.wordIds.forEach((id, i) => {
      const article = phrases.get(id)
      if (!article) return
      for (const dir of [['phrase'], ['phrase', 'slow']]) {
        const path = join(PUBLIC, 'audio', 'da', ...dir, `${article.toLowerCase()}-${board.slugs[i]}.mp3`)
        if (existsSync(path)) add(path)
        else missing.push(posix(path))
      }
    })
  }
  for (const slug of slugs) {
    // Every word in the 900 has its ordinary, slow and example clip.
    for (const dir of ['', 'slow', 'example']) {
      const path = join(PUBLIC, 'audio', 'da', dir, `${slug}.mp3`)
      if (existsSync(path)) add(path)
      else missing.push(posix(path))
    }
    // City 1 words also have their board and review sentence recordings.
    for (const dir of ['board', 'review']) {
      for (const path of walk(join(PUBLIC, 'audio', 'da', 'city1', dir, slug))) add(path)
    }
  }
  if (missing.length) throw new Error(`web demo audio missing: ${missing.join(', ')}`)
  return [...files].sort()
}

/** Vite plugin: copy the allowlisted slice of public/ into the demo's outDir. */
export function webDemoAssets() {
  let outDir = 'dist-web-demo'
  return {
    name: 'web-demo-assets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const file of webDemoAssetList()) {
        cpSync(join(PUBLIC, file), join(outDir, file), { recursive: false })
      }
    },
  }
}
