import { validateRecordingManifest } from './aoede-bake/manifest.mjs'
import { validateCity1Import } from './city1-content.mjs'
// Cross-checks the word audio manifests against src/data/words.<lang>.json,
// then compares the generated S3/S4 curriculum-audio source manifests with
// the accepted T6 content.
// every shipped headword must have a manifest row (and a clip on disk) in
// BOTH the ordinary and the slow source, and no manifest row may name a
// headword the dataset no longer has.
//
// This is the check WS2 added after 113 headwords left the dataset and 113
// arrived (docs/word-selection.md → archive/agent-docs-2026-09-20/docs/PLAN-2.md WS1/WS2) while the
// manifests kept the old rows and had none for the new ones — silent, because
// nothing else reads the manifest against the dataset. `--lang da` is the
// default; pass `--lang de` once a second dataset exists.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { slugForId } from './audio-slug.mjs'

const argLang = process.argv.indexOf('--lang')
const LANG = argLang === -1 ? 'da' : (process.argv[argLang + 1] ?? 'da')
if (!/^[a-z]{2}$/.test(LANG)) {
  console.error(`--lang must be a two-letter code, got "${LANG}"`)
  process.exit(2)
}

const WORDS_PATH = new URL(`../src/data/words.${LANG}.json`, import.meta.url)
const words = JSON.parse(readFileSync(WORDS_PATH, 'utf8'))
const headwordIds = new Set(words.map((w) => w.id))
if (headwordIds.size === 0) {
  console.error(`read no headwords out of src/data/words.${LANG}.json — the check would pass vacuously`)
  process.exit(2)
}

/**
 * One entry per audio source: the manifest that stamps it, and the directory
 * its clips live in (see CLAUDE.md trap 6 — a slug is a filename, not the
 * word id, and `audio-slug.mjs` is the single source for how one becomes the
 * other).
 */
const SOURCES = [
  { label: 'words', dir: `public/audio/${LANG}` },
  { label: 'words-slow', dir: `public/audio/${LANG}/slow` },
]

const errors = []
if (LANG === 'da') {
  await validateCity1Import(words)
  const pending = JSON.parse(readFileSync(new URL('../src/data/city1-sentence-audio.da.json', import.meta.url), 'utf8'))
  validateRecordingManifest(pending)
  console.log(`City1: 176 board + 176 review identities; ${pending.recordings.length}/704 verified variant records (${pending.status})`)
}

for (const { label, dir } of SOURCES) {
  const manifestPath = new URL(`../${dir}/manifest.json`, import.meta.url)
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    errors.push(`${label}: no manifest at ${dir}/manifest.json`)
    continue
  }
  const entries = manifest.entries ?? {}
  const rowIds = new Set()
  for (const [slug, entry] of Object.entries(entries)) {
    rowIds.add(entry.id)
    if (!headwordIds.has(entry.id)) {
      errors.push(`${label}: manifest row "${slug}" names ${entry.id}, which is not in the dataset (orphaned)`)
      continue
    }
    const clipPath = new URL(`../${dir}/${slug}.mp3`, import.meta.url)
    if (!existsSync(clipPath)) {
      errors.push(`${label}: manifest row "${slug}" (${entry.id}) has no clip at ${dir}/${slug}.mp3`)
    }
  }
  for (const id of headwordIds) {
    if (!rowIds.has(id)) {
      const slug = slugForId(id) ?? '?'
      errors.push(`${label}: ${id} (slug "${slug}") has no manifest row — not baked`)
    }
  }
}

/* ------------------------------------------------------------------ *
 * S2 example audio: exactly the frozen Danish exampleDa corpus, once.
 * ------------------------------------------------------------------ */

const exampleSourcePath = resolve('src/data', `example-audio.${LANG}.json`)
let exampleSource
try {
  exampleSource = JSON.parse(readFileSync(exampleSourcePath, 'utf8'))
} catch {
  errors.push(`examples: no source manifest at ${exampleSourcePath}`)
}

if (exampleSource) {
  if (LANG !== 'da' || exampleSource.language !== LANG || !Array.isArray(exampleSource.entries)) {
    errors.push(`examples: invalid Danish-only source manifest at ${exampleSourcePath}`)
  } else {
    const expectedById = new Map(words.map((word) => [word.id, word.exampleDa]))
    const seenIds = new Set()
    const seenSlugs = new Set()
    for (const row of exampleSource.entries) {
      const expectedText = expectedById.get(row.id)
      const slug = slugForId(row.id)
      if (!expectedText) errors.push(`examples: source row ${row.id} is not a dataset word`)
      if (seenIds.has(row.id)) errors.push(`examples: duplicate source row ${row.id}`)
      seenIds.add(row.id)
      if (!slug || seenSlugs.has(slug)) errors.push(`examples: duplicate or invalid slug for ${row.id}`)
      seenSlugs.add(slug)
      if (row.textDa !== expectedText) errors.push(`examples: ${row.id} differs from its instructional exampleDa (City1 board presentation uses the separate manifest)`)
      const hash = createHash('sha256').update(row.textDa ?? '').digest('hex')
      if (row.sourceHash !== hash) errors.push(`examples: ${row.id} has a stale sourceHash`)
    }
    for (const id of expectedById.keys()) if (!seenIds.has(id)) errors.push(`examples: ${id} has no source row`)
    if (exampleSource.entries.length !== 900) errors.push(`examples: expected exactly 900 Danish rows, got ${exampleSource.entries.length}`)

    // As with task audio, no cloud bake is required locally. If Actions has
    // written one, exact text/hash/clip parity is mandatory; otherwise say
    // plainly which accepted performances are still pending.
    const exampleDir = `public/audio/${LANG}/example`
    const bakedPath = resolve(exampleDir, 'manifest.json')
    if (existsSync(bakedPath)) {
      const baked = JSON.parse(readFileSync(bakedPath, 'utf8'))
      const entries = baked.entries ?? {}
      if (baked.voice !== 'da-DK-Chirp3-HD-Aoede') errors.push(`examples: expected Aoede, got ${baked.voice ?? 'no voice'}`)
      if (baked.rate !== 1) errors.push(`examples: expected rate 1, got ${baked.rate}`)
      for (const [slug, row] of Object.entries(entries)) {
        const expected = exampleSource.entries.find((entry) => slugForId(entry.id) === slug)
        if (!expected) errors.push(`examples: baked manifest has orphaned row ${slug}`)
        else {
          if (row.id !== expected.id) errors.push(`examples: ${slug} points at ${row.id}, expected ${expected.id}`)
          if (row.text !== expected.textDa) errors.push(`examples: ${slug} was baked from mismatched text`)
          if (row.sourceHash !== expected.sourceHash) errors.push(`examples: ${slug} was baked from a stale source hash`)
        }
        if (!existsSync(resolve(exampleDir, `${slug}.mp3`))) errors.push(`examples: baked row ${slug} has no clip`)
      }
      for (const expected of exampleSource.entries) {
        const slug = slugForId(expected.id)
        if (!entries[slug]) errors.push(`examples: ${expected.id} has no baked manifest row`)
      }
    } else {
      console.log(`examples: ${exampleSource.entries.length} frozen Danish performances awaiting the Actions bake`)
    }
  }
}

/* ------------------------------------------------------------------ *
 * Survival dialogue: one frozen Danish performance per authored turn.
 * ------------------------------------------------------------------ */

const survivalSourcePath = resolve('src/data', `survival-audio.${LANG}.json`)
let survivalSource
try {
  survivalSource = JSON.parse(readFileSync(survivalSourcePath, 'utf8'))
} catch {
  errors.push(`survival: no source manifest at ${survivalSourcePath}`)
}

if (survivalSource) {
  if (survivalSource.language !== LANG || !Array.isArray(survivalSource.entries) || survivalSource.entries.length === 0) {
    errors.push(`survival: invalid source manifest at ${survivalSourcePath}`)
  } else {
    const ids = new Set()
    for (const row of survivalSource.entries) {
      if (!/^[a-z0-9-]+-line-[1-4]$/.test(row.id ?? '')) errors.push(`survival: invalid id "${row.id}"`)
      if (ids.has(row.id)) errors.push(`survival: duplicate source id "${row.id}"`)
      ids.add(row.id)
      const hash = createHash('sha256').update(row.textDa ?? '').digest('hex')
      if (row.sourceHash !== hash) errors.push(`survival: ${row.id} has a stale sourceHash`)
    }

    const server = await createServer({
      configFile: false,
      root: process.cwd(),
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true },
      logLevel: 'silent',
    })
    try {
      if (LANG !== 'da') {
        errors.push(`survival: no authored ${LANG} guide is shipped`)
      } else {
        const { danishSurvivalGuide } = await server.ssrLoadModule('/src/lang/da/survival.ts')
        const expected = danishSurvivalGuide.cities.flatMap((city) => city.exchanges.flatMap((exchange) =>
          exchange.dialogue.map((line, lineIndex) => ({
            id: `${exchange.targetActivityId}-line-${lineIndex + 1}`,
            activityId: exchange.targetActivityId,
            lineIndex,
            textDa: line.da,
          })),
        ))
        const actual = survivalSource.entries.map(({ id, activityId, lineIndex, textDa }) => ({ id, activityId, lineIndex, textDa }))
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          errors.push('survival: source manifest differs from the authored guide; regenerate it before baking')
        }
        if (actual.length !== 144) errors.push(`survival: expected 144 dialogue turns, got ${actual.length}`)
      }
    } finally {
      await server.close()
    }

    const survivalDir = `public/audio/${LANG}/survival`
    const bakedPath = resolve(survivalDir, 'manifest.json')
    if (existsSync(bakedPath)) {
      const baked = JSON.parse(readFileSync(bakedPath, 'utf8'))
      const bakedEntries = baked.entries ?? {}
      const expectedById = new Map(survivalSource.entries.map((row) => [row.id, row]))
      for (const [id, row] of Object.entries(bakedEntries)) {
        const expected = expectedById.get(id)
        if (!expected) errors.push(`survival: baked manifest has orphaned row "${id}"`)
        else if (row.sourceHash !== expected.sourceHash) errors.push(`survival: ${id} was baked from a stale source hash`)
        if (!existsSync(resolve(survivalDir, `${id}.mp3`))) errors.push(`survival: baked row "${id}" has no clip`)
      }
      for (const id of expectedById.keys()) if (!bakedEntries[id]) errors.push(`survival: ${id} has no baked manifest row`)
    } else {
      console.log(`survival: ${survivalSource.entries.length} authored dialogue turns awaiting the Actions bake`)
    }
  }
}

/* ------------------------------------------------------------------ *
 * S4 task audio: static source manifest versus accepted T6 payload.
 *
 * make-audio.mjs deliberately stays Node-builtins-only in Actions. This small
 * JSON projection is therefore the bake input, while this validator loads the
 * canonical TypeScript content and refuses any drift before a bake can hide it.
 * ------------------------------------------------------------------ */

const taskSourcePath = resolve('src/data', `curriculum-audio.${LANG}.json`)
let taskSource
try {
  taskSource = JSON.parse(readFileSync(taskSourcePath, 'utf8'))
} catch {
  errors.push(`tasks: no source manifest at ${taskSourcePath}`)
}

if (taskSource) {
  if (taskSource.language !== LANG || !Array.isArray(taskSource.entries) || taskSource.entries.length === 0) {
    errors.push(`tasks: invalid source manifest at ${taskSourcePath}`)
  } else {
    const ids = new Set()
    for (const row of taskSource.entries) {
      if (!/^[a-z0-9-]+$/.test(row.id ?? '')) errors.push(`tasks: invalid id "${row.id}"`)
      if (ids.has(row.id)) errors.push(`tasks: duplicate source id "${row.id}"`)
      ids.add(row.id)
      const hash = createHash('sha256').update(row.textDa ?? '').digest('hex')
      if (row.sourceHash !== hash) errors.push(`tasks: ${row.id} has a stale sourceHash`)
    }

    const server = await createServer({
      configFile: false,
      root: process.cwd(),
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true },
      logLevel: 'silent',
    })
    try {
      if (LANG !== 'da') {
        errors.push(`tasks: no accepted ${LANG} T6 payload is shipped`)
      } else {
        const { danishCurriculumTaskAudio } = await server.ssrLoadModule('/src/lang/da/curriculum-audio.ts')
        const expected = danishCurriculumTaskAudio.map(({ id, activityId, kind, textDa }) => ({ id, activityId, kind, textDa }))
        const actual = taskSource.entries.map(({ id, activityId, kind, textDa }) => ({ id, activityId, kind, textDa }))
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          errors.push('tasks: source manifest differs from accepted T6 task audio; regenerate it before baking')
        }
      }
    } finally {
      await server.close()
    }

    // The cloud bake is intentionally external to local verification. Once
    // Actions writes its manifest, validate exact parity, source hashes and
    // clip presence; before then report the explicit pending state without
    // pretending silent placeholders are production performances.
    const taskDir = `public/audio/${LANG}/task`
    const bakedPath = resolve(taskDir, 'manifest.json')
    if (existsSync(bakedPath)) {
      const baked = JSON.parse(readFileSync(bakedPath, 'utf8'))
      const bakedEntries = baked.entries ?? {}
      const expectedById = new Map(taskSource.entries.map((row) => [row.id, row]))
      for (const [id, row] of Object.entries(bakedEntries)) {
        const expected = expectedById.get(id)
        if (!expected) errors.push(`tasks: baked manifest has orphaned row "${id}"`)
        else if (row.sourceHash !== expected.sourceHash) errors.push(`tasks: ${id} was baked from a stale source hash`)
        if (!existsSync(resolve(taskDir, `${id}.mp3`))) errors.push(`tasks: baked row "${id}" has no clip`)
      }
      for (const id of expectedById.keys()) if (!bakedEntries[id]) errors.push(`tasks: ${id} has no baked manifest row`)
    } else {
      console.log(`tasks: ${taskSource.entries.length} accepted utterances awaiting the Actions bake`)
    }
  }
}

/* ------------------------------------------------------------------ *
 * S3 chapter performances: the same projection discipline as S4, but one
 * continuous Danish clip and one timing map per destination chapter.
 *
 * The manual S3 workflow writes the clips later. Local validation must make
 * that pending state explicit without pretending an unavailable performance
 * is a broken word-audio bake.
 * ------------------------------------------------------------------ */

const chapterSourcePath = resolve('src/data', `chapter-audio.${LANG}.json`)
let chapterSource
try {
  chapterSource = JSON.parse(readFileSync(chapterSourcePath, 'utf8'))
} catch {
  errors.push(`chapters: no source manifest at ${chapterSourcePath}`)
}

if (chapterSource) {
  if (chapterSource.language !== LANG || !Array.isArray(chapterSource.entries) || chapterSource.entries.length === 0) {
    errors.push(`chapters: invalid source manifest at ${chapterSourcePath}`)
  } else {
    const ids = new Set()
    for (const row of chapterSource.entries) {
      if (!/^(chapter-\d{2}|lesson-[a-z0-9-]+)$/.test(row.id ?? '')) errors.push(`chapters: invalid id "${row.id}"`)
      if (ids.has(row.id)) errors.push(`chapters: duplicate source id "${row.id}"`)
      ids.add(row.id)
      if (!Array.isArray(row.linesDa) || row.linesDa.length === 0 || row.textDa !== row.linesDa.join('\n\n')) {
        errors.push(`chapters: ${row.id} has no Danish performance lines`)
      }
      const hash = createHash('sha256').update(row.textDa ?? '').digest('hex')
      if (row.sourceHash !== hash) errors.push(`chapters: ${row.id} has a stale sourceHash`)
    }

    const server = await createServer({
      configFile: false,
      root: process.cwd(),
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true },
      logLevel: 'silent',
    })
    try {
      if (LANG !== 'da') {
        errors.push(`chapters: no accepted ${LANG} T6 payload is shipped`)
      } else {
        const { danishGrammarLessonAudio } = await server.ssrLoadModule('/src/lang/da/chapter-audio.ts')
        const expected = danishGrammarLessonAudio.map(({ id, lessonId, cityId, cityIndex, linesDa, textDa }) => ({
          id,
          lessonId,
          cityId,
          cityIndex,
          linesDa,
          textDa,
          sourceHash: createHash('sha256').update(textDa).digest('hex'),
        }))
        const actualById = new Map(chapterSource.entries.map((row) => [row.id, row]))
        const expectedById = new Map(expected.map((row) => [row.id, row]))
        for (const row of expected) {
          const actual = actualById.get(row.id)
          if (!actual) {
            errors.push(`chapters: ${row.id} (${row.lessonId}) has no frozen source row — new Aoede bake required`)
            continue
          }
          const current = { id: actual.id, cityId: actual.cityId, cityIndex: actual.cityIndex, linesDa: actual.linesDa, textDa: actual.textDa, sourceHash: actual.sourceHash }
          const canonical = { id: row.id, cityId: row.cityId, cityIndex: row.cityIndex, linesDa: row.linesDa, textDa: row.textDa, sourceHash: row.sourceHash }
          if (JSON.stringify(current) !== JSON.stringify(canonical)) {
            errors.push(`chapters: ${row.id} (${row.lessonId}) has stale canonical lines — Aoede rebake required`)
          }
        }
        for (const row of chapterSource.entries) if (!expectedById.has(row.id)) errors.push(`chapters: frozen source row ${row.id} no longer has a canonical lesson`)
      }
    } finally {
      await server.close()
    }

    const chapterDir = `public/audio/${LANG}/chapter`
    const bakedPath = resolve(chapterDir, 'manifest.json')
    // This JSON is outside /audio/ so the shell precaches a tiny timing map
    // while the large performances remain on-demand CacheFirst requests.
    // An empty root map is the explicit pre-bake state and is valid by itself.
    const timingPath = resolve(`public/chapter-timings.${LANG}.json`)
    if (existsSync(bakedPath)) {
      if (!existsSync(timingPath)) {
        errors.push('chapters: a baked clip manifest needs its timing map')
      } else {
        const baked = JSON.parse(readFileSync(bakedPath, 'utf8'))
        const timings = JSON.parse(readFileSync(timingPath, 'utf8'))
        const bakedEntries = baked.entries ?? {}
        const timingsById = new Map((timings.entries ?? []).map((row) => [row.id, row]))
        const expectedById = new Map(chapterSource.entries.map((row) => [row.id, row]))
        for (const [id, row] of Object.entries(bakedEntries)) {
          const expected = expectedById.get(id)
          if (!expected) errors.push(`chapters: baked manifest has orphaned row "${id}"`)
          else if (row.sourceHash !== expected.sourceHash) errors.push(`chapters: ${id} was baked from a stale source hash`)
          if (!existsSync(resolve(chapterDir, `${id}.mp3`))) errors.push(`chapters: baked row "${id}" has no clip`)
        }
        for (const [id, expected] of expectedById) {
          if (!bakedEntries[id]) errors.push(`chapters: ${id} has no baked manifest row`)
          const timing = timingsById.get(id)
          if (!timing) {
            errors.push(`chapters: ${id} has no timing row`)
          } else if (
            timing.sourceHash !== expected.sourceHash ||
            !Number.isFinite(timing.duration) || timing.duration <= 0 ||
            !Array.isArray(timing.starts) || timing.starts.length !== expected.linesDa.length ||
            timing.starts[0] !== 0 ||
            timing.starts.some((start, index) => !Number.isFinite(start) || start < 0 || start >= timing.duration || (index > 0 && start <= timing.starts[index - 1]))
          ) {
            errors.push(`chapters: ${id} has an invalid or stale timing row`)
          }
        }
        for (const id of timingsById.keys()) if (!expectedById.has(id)) errors.push(`chapters: timing map has orphaned row "${id}"`)
      }
    } else {
      console.log(`chapters: ${chapterSource.entries.length} accepted performances awaiting the separate manual bake`)
    }
  }
}

if (errors.length) {
  console.error(`${errors.length} audio/dataset mismatches for --lang ${LANG}:`)
  for (const e of errors.slice(0, 60)) console.error(`  ✗ ${e}`)
  if (errors.length > 60) console.error(`  … and ${errors.length - 60} more`)
  process.exit(1)
}

console.log(
  `${headwordIds.size} headwords, ${SOURCES.length} sources checked for --lang ${LANG}` +
  ` — every headword has a clip and manifest row in each, no orphans.`,
)
