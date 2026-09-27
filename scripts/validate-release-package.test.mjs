import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { corpusSentinels, derivedLexicon, orchestrationSentinels } from './validate-client-boundary.mjs'
import { inspectReleasePackage } from './validate-release-package.mjs'
import {
  APP_ID,
  PUBLIC_UI_LANGUAGES,
  RELEASE_PROVENANCE_FILE,
  RELEASE_PROVENANCE_SCHEMA,
} from './stamp-release-package.mjs'

const made = []
const data = resolve('proxy/data')

function publicPolicy(overrides = {}) {
  return {
    learnerCourse: 'da',
    germanLearnerCourse: 'playable-for-normal',
    previewOnlyLearnerPacks: 'hidden-for-normal',
    openRouteEnd: 0,
    passGateEnabled: false,
    publicUiLanguages: PUBLIC_UI_LANGUAGES,
    appId: APP_ID,
    ...overrides,
  }
}

afterEach(() => {
  for (const path of made.splice(0)) rmSync(path, { recursive: true, force: true })
})

function packageRoot(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cluecab-sec4-'))
  made.push(root)
  const lexicon = JSON.stringify(derivedLexicon(data).entries)
  for (const [name, content] of Object.entries({ 'assets/lexicon.js': lexicon, ...files })) {
    const path = join(root, name)
    mkdirSync(resolve(path, '..'), { recursive: true })
    writeFileSync(path, content)
  }
  return root
}

function publicPackage(overrides = {}, files = {}) {
  const sha = 'a'.repeat(40)
  const provenance = {
    schemaVersion: RELEASE_PROVENANCE_SCHEMA,
    audience: 'normal',
    sourceRef: 'refs/heads/release/ios-1.0',
    sourceSha: sha,
    checkoutSha: sha,
    workflowSha: sha,
    expectedSourceSha: sha,
    appVersion: '1.0',
    buildNumber: '123',
    publicPolicy: publicPolicy(),
    ...overrides,
  }
  return {
    root: packageRoot({
      'assets/app.js': `const audience='__900WORDS_BUILD_AUDIENCE__:normal'`,
      [RELEASE_PROVENANCE_FILE]: JSON.stringify(provenance),
      ...files,
    }),
    sha,
  }
}

function storedIpa(files) {
  // A small standards-compliant stored ZIP: enough to exercise the IPA reader
  // without relying on a host zip binary.
  const parts = []
  const central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name)
    const body = Buffer.from(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(body.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    parts.push(local, nameBytes, body)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt32LE(body.length, 20)
    entry.writeUInt32LE(body.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBytes)
    offset += local.length + nameBytes.length + body.length
  }
  const centralBytes = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  const path = join(mkdtempSync(join(tmpdir(), 'cluecab-sec4-')), 'App.ipa')
  made.push(resolve(path, '..'))
  writeFileSync(path, Buffer.concat([...parts, centralBytes, end]))
  return path
}

describe('the SEC4 release-package gate', () => {
  it('allows the shipped flat L1 lexicon in a web or staged native payload', () => {
    expect(inspectReleasePackage(packageRoot(), data).violations).toEqual([])
  })

  it('fails a real book rationale even when it is hidden in a JS chunk', () => {
    const rationale = corpusSentinels(data).find((item) => item.source.startsWith('book.') && item.value.length > 36)
    const result = inspectReleasePackage(packageRoot({ 'assets/app.js': rationale.value }), data)
    expect(result.violations).toEqual(expect.arrayContaining([expect.stringContaining(`from ${rationale.source}`)]))
  })

  it('allows native orchestration without allowing authored model corpora', () => {
    const prompt = orchestrationSentinels(data)[0]
    expect(
      inspectReleasePackage(packageRoot({ 'assets/prompt.js': prompt.value }), data, {
        allowOnDeviceOrchestration: true,
      }).violations,
    ).toEqual([])

    const rationale = corpusSentinels(data).find(
      (item) => item.source.startsWith('book.') && item.value.length > 36,
    )
    expect(
      inspectReleasePackage(packageRoot({ 'assets/book.js': rationale.value }), data, {
        allowOnDeviceOrchestration: true,
      }).violations,
    ).toEqual(expect.arrayContaining([expect.stringContaining(`from ${rationale.source}`)]))
  })

  describe('a native build with on-device Casey', () => {
    const native = { allowOnDeviceOrchestration: true, allowOnDeviceCity1Corpus: true }
    const bookRationale = (source) => {
      const found = corpusSentinels(data).find((item) => item.source === source && item.value !== item.source)
      expect(found, source).toBeDefined()
      return found
    }
    // What Vite makes of a book import: its JSON, `why` keys and all, in a chunk.
    const bookChunk = (source) => JSON.stringify({ words: { x: { assoc: [{ why: bookRationale(source).value }] } } })

    it('may package City 1’s book, rationales included, in her own chunk', () => {
      const result = inspectReleasePackage(packageRoot({ 'assets/decision.js': bookChunk('book.da.1.json') }), data, native)
      expect(result.violations).toEqual([])
    })

    it('still refuses raw rationales in any other file', () => {
      const result = inspectReleasePackage(packageRoot({ 'assets/app.js': '{"why": "a stray rationale"}' }), data, native)
      expect(result.violations).toEqual([expect.stringContaining('raw votes or rationales were packaged')])
    })

    it('still refuses every other city’s book', () => {
      for (const source of ['book.da.2.json', 'book.da.9.json']) {
        const result = inspectReleasePackage(packageRoot({ 'assets/decision.js': bookChunk(source) }), data, native)
        expect(result.violations, source).toEqual(
          expect.arrayContaining([expect.stringContaining(`contains private server material from ${source}`)]),
        )
      }
    })

    it('still refuses City 1’s book in a web package', () => {
      const result = inspectReleasePackage(packageRoot({ 'assets/decision.js': bookChunk('book.da.1.json') }), data)
      expect(result.violations).toEqual(
        expect.arrayContaining([expect.stringContaining('contains private server material from book.da.1.json')]),
      )
    })
  })

  it('fails each release-only escape hatch: raw data, plans, maps, credentials, and a bundled model', () => {
    const result = inspectReleasePackage(
      packageRoot({
        'public/book.da.1.json': '{}',
        'assets/votes.json': '{"votes":["raw"]}',
        'docs/PLAN-2.md': 'internal',
        'assets/app.js.map': '{}',
        'assets/gemma-4-E4B-it-gpu.litertlm': 'not really a model',
        '.env.production': 'GEMINI_API_KEY=AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
      }),
      data,
    )
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.stringContaining('authored book or matrix'),
      expect.stringContaining('raw votes or rationales'),
      expect.stringContaining('internal plan'),
      expect.stringContaining('source map'),
      expect.stringContaining('API key or secret'),
      expect.stringContaining('on-device model was packaged instead of downloaded'),
    ]))
  })

  it('reads an IPA itself instead of trusting the staged folder', () => {
    const ipa = storedIpa({
      'Payload/App.app/public/assets/lexicon.js': JSON.stringify(derivedLexicon(data).entries),
      'Payload/App.app/public/assets/matrix.da.1.json': '{}',
    })
    expect(inspectReleasePackage(ipa, data).violations).toEqual(expect.arrayContaining([expect.stringContaining('authored book or matrix')]))
  })

  it('accepts a stamped normal public package at the approved source', () => {
    const { root, sha } = publicPackage()
    expect(inspectReleasePackage(root, data, {
      expectedAudience: 'normal',
      expectedSourceSha: sha,
    }).violations).toEqual([])
  })

  it.each([
    ['developer audience', { audience: 'developer' }, {}, 'expected normal audience'],
    ['non-Danish default', { publicPolicy: publicPolicy({ learnerCourse: 'de' }) }, {}, 'public learner course is not Danish'],
    ['German learner course without playable readiness', { publicPolicy: publicPolicy({ germanLearnerCourse: 'not-playable-for-normal' }) }, {}, 'German learner course is not playable'],
    ['preview-only future learner course', { publicPolicy: publicPolicy({ previewOnlyLearnerPacks: 'exposed-or-not-enforced' }) }, {}, 'preview-only learner packs are not blocked'],
    ['later travel', { publicPolicy: publicPolicy({ openRouteEnd: 1 }) }, {}, 'later travel'],
    ['pass gate', { publicPolicy: publicPolicy({ passGateEnabled: true }) }, {}, 'travel/pass gate'],
    ['wrong source', { sourceSha: 'b'.repeat(40) }, {}, 'source SHA does not match'],
    ['Worker data', {}, { 'proxy/data/authored-clues.da.1.json': '{}' }, 'research or Worker-only path'],
  ])('rejects a public package with %s', (_label, provenance, files, message) => {
    const { root, sha } = publicPackage(provenance, files)
    expect(inspectReleasePackage(root, data, {
      expectedAudience: 'normal',
      expectedSourceSha: sha,
    }).violations.join('\n')).toContain(message)
  })

  it('rejects a developer marker hidden beside a normal provenance file', () => {
    const { root, sha } = publicPackage({}, {
      'assets/extra.js': `const audience='__900WORDS_BUILD_AUDIENCE__:developer'`,
    })
    expect(inspectReleasePackage(root, data, {
      expectedAudience: 'normal',
      expectedSourceSha: sha,
    }).violations.join('\n')).toContain('conflicting developer audience marker')
  })
})
