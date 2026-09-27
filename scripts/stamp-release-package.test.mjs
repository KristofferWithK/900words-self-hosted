import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createReleaseProvenance } from './stamp-release-package.mjs'

const made = []
const SHA = 'a'.repeat(40)

function fixture({
  previewGuarded = true,
  germanReadiness = 'playable',
  routeEnd = 0,
  pass = false,
  audience = 'normal',
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cluecab-release-source-'))
  made.push(root)
  const files = {
    'src/build/audience.ts': `export function audienceAllowsLearnerPreview(audience) { return audience !== 'normal' }`,
    'src/lang/index.ts': `import { audienceAllowsLearnerPreview } from '../build/audience'
import { german } from './de'
export const LANGUAGES = { da: { code: 'da', readiness: 'playable' }, de: german, es: { code: 'es', readiness: 'preview' } }
export const DEFAULT_LANGUAGE = 'da'
export function languageAvailable(code, audience) {
  const pack = LANGUAGES[code]
  return ${previewGuarded ? "!!pack && (pack.readiness !== 'preview' || audienceAllowsLearnerPreview(audience))" : '!!pack'}
}
export const packFor = (code, audience) => {
  const pack = LANGUAGES[code]
  if (!pack || !languageAvailable(code, audience)) return LANGUAGES[DEFAULT_LANGUAGE]
  return pack
}
export const availableLanguages = (audience) => Object.values(LANGUAGES).filter((pack) => languageAvailable(pack.code, audience))
export const hasLanguageChoice = (audience) => availableLanguages(audience).length > 1`,
    'src/lang/de/index.ts': `export const german = { code: 'de', readiness: '${germanReadiness}', words: ['Mutter'], route: ['Flensburg'], rosters: { 0: ['de:Mutter'] } }`,
    'src/journey/trainService.ts': `export const OPEN_ROUTE_END = ${routeEnd}`,
    'src/purchase/pass.ts': `export const PASS_GATE_ENABLED = ${pass}`,
    'src/i18n/types.ts': `export const UI_LANGUAGES = ['en','de','sv','pl','pt','zh','fr']`,
    'capacitor.config.ts': `export default { appId: 'com.kristofferwithk.cluecabulary' }`,
  }
  for (const [name, content] of Object.entries(files)) {
    const path = join(root, name)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, content)
  }
  const target = join(root, 'dist')
  mkdirSync(target)
  writeFileSync(join(target, 'app.js'), `const marker='__900WORDS_BUILD_AUDIENCE__:${audience}'`)
  return { root, target }
}

function env(overrides = {}) {
  return {
    BUILD_AUDIENCE: 'normal',
    GITHUB_REF: 'refs/heads/release/ios-1.0',
    GITHUB_SHA: SHA,
    CHECKOUT_SHA: SHA,
    GITHUB_WORKFLOW_SHA: SHA,
    EXPECTED_SOURCE_SHA: SHA,
    APP_VERSION: '1.0',
    BUILD_NUMBER: '123',
    ...overrides,
  }
}

afterEach(() => {
  for (const path of made.splice(0)) rmSync(path, { recursive: true, force: true })
})

describe('release package provenance stamp', () => {
  it('accepts German City 1 as playable while keeping Danish default and future previews gated', () => {
    const { root, target } = fixture()
    const result = createReleaseProvenance({ root, target, env: env() })
    expect(result.errors).toEqual([])
    expect(result.provenance.publicPolicy).toMatchObject({
      learnerCourse: 'da',
      germanLearnerCourse: 'playable-for-normal',
      previewOnlyLearnerPacks: 'hidden-for-normal',
    })
  })

  it.each([
    ['preview-only future learner course', { previewGuarded: false }, 'preview-only learner packs'],
    ['German learner course exposed without playable readiness', { germanReadiness: 'preview' }, 'German learner course is not playable'],
    ['later travel', { routeEnd: 1 }, 'later travel'],
    ['pass gate', { pass: true }, 'travel/pass gate'],
  ])('rejects public exposure of %s', (_label, fixtureOptions, message) => {
    const { root, target } = fixture(fixtureOptions)
    expect(createReleaseProvenance({ root, target, env: env() }).errors.join('\n')).toContain(message)
  })

  it('rejects a developer bundle relabelled as normal', () => {
    const { root, target } = fixture({ audience: 'developer' })
    expect(createReleaseProvenance({ root, target, env: env() }).errors.join('\n')).toContain('__900WORDS_BUILD_AUDIENCE__:normal')
  })

  it('permits an explicitly stamped internal developer build without public-candidate claims', () => {
    const { root, target } = fixture({ previewGuarded: false, audience: 'developer' })
    const result = createReleaseProvenance({ root, target, env: env({
      BUILD_AUDIENCE: 'developer',
      GITHUB_REF: 'refs/heads/internal',
      GITHUB_WORKFLOW_SHA: 'b'.repeat(40),
      EXPECTED_SOURCE_SHA: '',
      APP_VERSION: '0.1.0',
    }) })
    expect(result.errors).toEqual([])
  })
})
