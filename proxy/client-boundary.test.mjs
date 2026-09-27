import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  corpusSentinels,
  derivedLexicon,
  inspectClientBuild,
  onDeviceCaseyBuild,
  orchestrationSentinels,
} from '../scripts/validate-client-boundary.mjs'

const made = []
const data = resolve('proxy/data')

afterEach(() => {
  for (const path of made.splice(0)) rmSync(path, { recursive: true, force: true })
})

const build = (name = 'assets/app.js', content = 'console.log("client")') => {
  const root = mkdtempSync(join(tmpdir(), 'cluecab-sec3-'))
  made.push(root)
  const path = join(root, name)
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, content)
  return root
}

describe('the SEC3 production-client corpus gate', () => {
  it('admits only the generated L1 {da,en} allowance', () => {
    const lexicon = derivedLexicon(data)
    expect(lexicon.entries.length).toBeGreaterThan(2000)
    expect(lexicon.entries.every((entry) => Object.keys(entry).sort().join(',') === 'da,en')).toBe(true)
  })

  it('passes a client with no authored material', () => {
    expect(inspectClientBuild(build(), data).violations).toEqual([])
  })

  it('fails when one authored rationale is injected into a client chunk', () => {
    const sentinel = corpusSentinels(data).find(
      (item) => item.source.startsWith('book.') && item.value !== item.source && item.value.length >= 36,
    )
    expect(sentinel).toBeDefined()
    const result = inspectClientBuild(build('assets/app.js', `export default ${JSON.stringify(sentinel.value)}`), data)
    expect(result.violations).toEqual([
      expect.stringContaining(`contains private server material from ${sentinel.source}`),
    ])
  })

  it('fails when a row of the canonical LCSI strengths is inlined into a client chunk', () => {
    const sentinel = corpusSentinels(data).find(
      (item) => item.source.startsWith('lcsi.') && item.value !== item.source && item.value.startsWith('[['),
    )
    expect(sentinel).toBeDefined()
    const result = inspectClientBuild(build('assets/app.js', `export default ${JSON.stringify(sentinel.value)}`), data)
    expect(result.violations).toEqual([
      expect.stringContaining(`contains private server material from ${sentinel.source}`),
    ])
  })

  it('fails when packed matrix data is inlined into a client chunk', () => {
    const sentinel = corpusSentinels(data).find(
      (item) => item.source.startsWith('matrix.') && item.value !== item.source,
    )
    expect(sentinel).toBeDefined()
    const result = inspectClientBuild(build('assets/matrix.js', `export default ${JSON.stringify(sentinel.value)}`), data)
    expect(result.violations).toEqual([
      expect.stringContaining(`contains private server material from ${sentinel.source}`),
    ])
  })

  it('fails when the private certification index is inlined into a client chunk', () => {
    const sentinel = corpusSentinels(data).find(
      (item) => item.source.startsWith('deal-index.') && item.value !== item.source,
    )
    expect(sentinel).toBeDefined()
    const result = inspectClientBuild(build('assets/deal.js', JSON.stringify(sentinel.value)), data)
    expect(result.violations).toEqual([
      expect.stringContaining(`contains private server material from ${sentinel.source}`),
    ])
  })

  it('fails when the private association index is inlined into a client chunk', () => {
    const sentinel = corpusSentinels(data).find(
      (item) => item.source.startsWith('association-index.') && item.value !== item.source,
    )
    expect(sentinel).toBeDefined()
    const result = inspectClientBuild(build('assets/associations.js', JSON.stringify(sentinel.value)), data)
    expect(result.violations).toEqual([
      expect.stringContaining(`contains private server material from ${sentinel.source}`),
    ])
  })

  it('fails when a server prompt is pulled into a client chunk', () => {
    const sentinel = orchestrationSentinels(data)[0]
    const result = inspectClientBuild(build('assets/prompt.js', JSON.stringify(sentinel.value)), data)
    expect(result.violations).toEqual([
      expect.stringContaining(`contains private server material from ${sentinel.source}`),
    ])
  })

  it('allows reviewed orchestration only in a native build while still rejecting corpora', () => {
    const prompt = orchestrationSentinels(data)[0]
    expect(
      inspectClientBuild(build('assets/prompt.js', JSON.stringify(prompt.value)), data, {
        allowOnDeviceOrchestration: true,
      }).violations,
    ).toEqual([])

    const corpus = corpusSentinels(data).find(
      (item) => item.source.startsWith('matrix.') && item.value !== item.source,
    )
    expect(corpus).toBeDefined()
    expect(
      inspectClientBuild(build('assets/matrix.js', JSON.stringify(corpus.value)), data, {
        allowOnDeviceOrchestration: true,
      }).violations,
    ).toEqual([expect.stringContaining(`contains private server material from ${corpus.source}`)])
  })

  /** A native build: index.html, its start-up entry, and one lazy chunk. */
  const nativeBuild = ({ entry = 'console.log("app")', lazy = 'console.log("later")' } = {}) => {
    const root = build('index.html', '<script type="module" crossorigin src="./assets/index-abc123.js"></script>')
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets', 'index-abc123.js'), entry)
    writeFileSync(join(root, 'assets', 'decision-def456.js'), lazy)
    return root
  }
  const onDeviceFlags = { allowOnDeviceOrchestration: true, allowOnDeviceCity1Corpus: true }
  const sentinelFrom = (source) => {
    const found = corpusSentinels(data).find((item) => item.source === source && item.value !== item.source)
    expect(found, source).toBeDefined()
    return found
  }

  it('lets a native build carry City 1 shards for on-device Casey in her lazy chunk', () => {
    const lazy = ['matrix.da.1.json', 'book.da.1.json', 'deal-index.da.1.json', 'association-index.da.1.json', 'lcsi.da.1.json']
      .map((source) => JSON.stringify(sentinelFrom(source).value))
      .join('\n')
    expect(inspectClientBuild(nativeBuild({ lazy }), data, onDeviceFlags).violations).toEqual([])
  })

  it('refuses City 1 shards in the start-up entry of a native build', () => {
    const book = sentinelFrom('book.da.1.json')
    const result = inspectClientBuild(nativeBuild({ entry: JSON.stringify(book.value) }), data, onDeviceFlags)
    expect(result.violations).toEqual([expect.stringContaining('book.da.1.json at start-up')])
  })

  it('keeps every other city Worker-only, even for on-device Casey', () => {
    for (const source of ['book.da.2.json', 'book.da.9.json', 'deal-index.da.2.json', 'matrix.da.9.json']) {
      const other = sentinelFrom(source)
      const result = inspectClientBuild(nativeBuild({ lazy: JSON.stringify(other.value) }), data, onDeviceFlags)
      expect(result.violations, source).toEqual([expect.stringContaining(`contains private server material from ${source}`)])
    }
  })

  it('grants that allowance to the developer and normal native builds and every open-source build', () => {
    expect(onDeviceCaseyBuild({ CAP_BUILD: '1', BUILD_AUDIENCE: 'developer' })).toBe(true)
    // The signed-app inspection names the audience this way instead.
    expect(onDeviceCaseyBuild({ CAP_BUILD: '1', RELEASE_EXPECTED_AUDIENCE: 'developer' })).toBe(true)
    expect(onDeviceCaseyBuild({ CAP_BUILD: '1', BUILD_AUDIENCE: 'normal' })).toBe(true)
    expect(onDeviceCaseyBuild({ CAP_BUILD: '1', RELEASE_EXPECTED_AUDIENCE: 'normal' })).toBe(true)
    // Open-source builds run Casey's logic in the app on every platform.
    expect(onDeviceCaseyBuild({ CAP_BUILD: '1', BUILD_AUDIENCE: 'open-source' })).toBe(true)
    expect(onDeviceCaseyBuild({ BUILD_AUDIENCE: 'open-source' })).toBe(true)
    expect(onDeviceCaseyBuild({ CAP_BUILD: '1', BUILD_AUDIENCE: 'feedback' })).toBe(false)
    // No audience is a normal build, as in vite.config.ts.
    expect(onDeviceCaseyBuild({ CAP_BUILD: '1' })).toBe(true)
    expect(onDeviceCaseyBuild({ BUILD_AUDIENCE: 'developer' })).toBe(false)
    expect(onDeviceCaseyBuild({ BUILD_AUDIENCE: 'normal' })).toBe(false)
  })

  it('still refuses City 1 shards in a web build', () => {
    const book = sentinelFrom('book.da.1.json')
    const result = inspectClientBuild(nativeBuild({ lazy: JSON.stringify(book.value) }), data)
    expect(result.violations).toEqual([expect.stringContaining('contains private server material from book.da.1.json')])
  })

  it('fails when a raw corpus file is copied under public assets', () => {
    const result = inspectClientBuild(build('assets/book.da.1.json', '{}'), data)
    expect(result.violations).toEqual([expect.stringContaining('authored corpus filename was emitted')])
  })

  it('fails when a raw certification index is copied under public assets', () => {
    const result = inspectClientBuild(build('assets/deal-index.da.1.json', '{}'), data)
    expect(result.violations).toEqual([expect.stringContaining('authored corpus filename was emitted')])
  })

  it('fails when a raw association index is copied under public assets', () => {
    const result = inspectClientBuild(build('assets/association-index.da.1.json', '{}'), data)
    expect(result.violations).toEqual([expect.stringContaining('authored corpus filename was emitted')])
  })

  it('still fails if a private book is disguised as the permitted L1 asset', () => {
    const book = join(data, 'book.da.1.json')
    const result = inspectClientBuild(build('assets/clue-lexicon.da.json', readFileSync(book, 'utf8')), data)
    expect(result.violations).toHaveLength(3)
    expect(result.violations.every((line) => line.includes('contains private server material from book.da.1.json'))).toBe(true)
  })
})
