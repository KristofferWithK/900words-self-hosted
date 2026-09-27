import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateTestflightDispatch } from './testflight-dispatch-guard.mjs'

export const RELEASE_PROVENANCE_FILE = '900words-build-provenance.json'
export const RELEASE_PROVENANCE_SCHEMA = 2
export const PUBLIC_UI_LANGUAGES = ['en', 'de', 'sv', 'pl', 'pt', 'zh', 'fr']
export const APP_ID = 'com.kristofferwithk.cluecabulary'

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.json', '.mjs'])
const audienceMarker = (audience) => `__900WORDS_BUILD_AUDIENCE__:${audience}`

const read = (root, path) => readFileSync(join(root, path), 'utf8')

function parseUiLanguages(source) {
  const body = source.match(/UI_LANGUAGES[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? ''
  return [...body.matchAll(/['"]([a-z]+)['"]/g)].map((match) => match[1])
}

function exportedBlock(source, name) {
  const start = source.indexOf(`export const ${name}`)
  if (start < 0) return ''
  const next = source.indexOf('\nexport ', start + 1)
  return source.slice(start, next < 0 ? source.length : next)
}

/** Read release-critical constants and the normal-audience preview seam. */
export function inspectReleaseSource(root) {
  const audience = read(root, 'src/build/audience.ts')
  const languages = read(root, 'src/lang/index.ts')
  const germanSource = read(root, 'src/lang/de/index.ts')
  const route = read(root, 'src/journey/trainService.ts')
  const pass = read(root, 'src/purchase/pass.ts')
  const ui = read(root, 'src/i18n/types.ts')
  const capacitor = read(root, 'capacitor.config.ts')

  const languageAvailabilityStart = languages.indexOf('export function languageAvailable')
  const nextLanguageExport = languages.indexOf('\nexport ', languageAvailabilityStart + 1)
  const languageAvailability = languageAvailabilityStart < 0
    ? ''
    : languages.slice(languageAvailabilityStart, nextLanguageExport < 0 ? undefined : nextLanguageExport)
  const previewPolicyStart = audience.indexOf('export function audienceAllowsLearnerPreview')
  const nextAudienceExport = audience.indexOf('\nexport ', previewPolicyStart + 1)
  const previewPolicy = previewPolicyStart < 0
    ? ''
    : audience.slice(previewPolicyStart, nextAudienceExport < 0 ? undefined : nextAudienceExport)
  const packFor = exportedBlock(languages, 'packFor')
  const availableLanguages = exportedBlock(languages, 'availableLanguages')
  const hasLanguageChoice = exportedBlock(languages, 'hasLanguageChoice')
  const usesSharedAvailability =
    /languageAvailable\s*\(/.test(packFor) &&
    /languageAvailable\s*\(/.test(availableLanguages) &&
    /availableLanguages\s*\(/.test(hasLanguageChoice)
  const previewsAreGated =
    /pack\.readiness\s*!==\s*['"]preview['"]\s*\|\|\s*audienceAllowsLearnerPreview\s*\(\s*audience\s*\)/.test(languageAvailability) &&
    /return\s+audience\s*!==\s*['"]normal['"]/.test(previewPolicy) &&
    usesSharedAvailability
  const german = exportedBlock(germanSource, 'german')
  const languageRegistry = exportedBlock(languages, 'LANGUAGES')
  const germanIsPlayable =
    /import\s*\{\s*german\s*\}\s*from\s*['"]\.\/de['"]/.test(languages) &&
    /\bde\s*:\s*german\b/.test(languageRegistry) &&
    /\breadiness\s*:\s*['"]playable['"]/.test(german) &&
    ['words', 'route', 'rosters'].every((field) => new RegExp(`\\b${field}\\s*:`).test(german)) &&
    /pack\.readiness\s*!==\s*['"]preview['"]/.test(languageAvailability) &&
    usesSharedAvailability
  const defaultLanguage = languages.match(/export const DEFAULT_LANGUAGE(?:\s*:\s*[^=]+)?\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null
  const openRouteEnd = Number(route.match(/export const OPEN_ROUTE_END\s*=\s*(\d+)/)?.[1] ?? NaN)
  const passGateEnabled = pass.match(/export const PASS_GATE_ENABLED\s*=\s*(true|false)/)?.[1] === 'true'
  const publicUiLanguages = parseUiLanguages(ui)
  const appId = capacitor.match(/appId:\s*['"]([^'"]+)['"]/)?.[1] ?? null

  return {
    learnerCourse: defaultLanguage,
    germanLearnerCourse: germanIsPlayable ? 'playable-for-normal' : 'not-playable-for-normal',
    previewOnlyLearnerPacks: previewsAreGated ? 'hidden-for-normal' : 'exposed-or-not-enforced',
    openRouteEnd,
    passGateEnabled,
    publicUiLanguages,
    appId,
  }
}

function filesUnder(root) {
  const found = []
  for (const name of readdirSync(root)) {
    const path = join(root, name)
    if (statSync(path).isDirectory()) found.push(...filesUnder(path))
    else found.push(path)
  }
  return found
}

function markerCounts(target) {
  const text = filesUnder(target)
    .filter((path) => TEXT_EXTENSIONS.has(extname(path).toLowerCase()))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')
  return Object.fromEntries(
    ['normal', 'feedback', 'developer', 'web-demo'].map((audience) => [
      audience,
      text.includes(audienceMarker(audience)),
    ]),
  )
}

export function validatePublicPolicy(policy) {
  const errors = []
  if (policy.learnerCourse !== 'da') errors.push('public learner course is not Danish')
  if (policy.germanLearnerCourse !== 'playable-for-normal') {
    errors.push('German learner course is not playable for normal-audience restores, URLs, and pickers')
  }
  if (policy.previewOnlyLearnerPacks !== 'hidden-for-normal') {
    errors.push('preview-only learner packs are not blocked for normal-audience restores, URLs, and pickers')
  }
  if (policy.openRouteEnd !== 0) errors.push(`later travel is open through route index ${policy.openRouteEnd}`)
  if (policy.passGateEnabled !== false) errors.push('travel/pass gate is enabled')
  if (JSON.stringify(policy.publicUiLanguages) !== JSON.stringify(PUBLIC_UI_LANGUAGES)) {
    errors.push(`public UI languages changed: ${JSON.stringify(policy.publicUiLanguages)}`)
  }
  if (policy.appId !== APP_ID) errors.push(`Capacitor app id changed: ${JSON.stringify(policy.appId)}`)
  return errors
}

export function createReleaseProvenance({ root, target, env }) {
  const dispatch = validateTestflightDispatch({
    audience: env.BUILD_AUDIENCE,
    sourceRef: env.GITHUB_REF,
    sourceSha: env.GITHUB_SHA,
    checkoutSha: env.CHECKOUT_SHA,
    workflowSha: env.GITHUB_WORKFLOW_SHA,
    expectedSourceSha: env.EXPECTED_SOURCE_SHA,
  })
  const errors = [...dispatch.errors]
  const policy = inspectReleaseSource(root)
  const markers = markerCounts(target)
  if (!markers[env.BUILD_AUDIENCE]) {
    errors.push(`compiled package is missing ${audienceMarker(env.BUILD_AUDIENCE)}`)
  }
  for (const audience of ['normal', 'feedback', 'developer', 'web-demo']) {
    if (audience !== env.BUILD_AUDIENCE && markers[audience]) {
      errors.push(`compiled package also contains the ${audience} audience marker`)
    }
  }
  if (env.BUILD_AUDIENCE === 'normal') errors.push(...validatePublicPolicy(policy))

  const appVersion = env.APP_VERSION
  if (env.BUILD_AUDIENCE === 'normal' && appVersion !== '1.0') errors.push('normal audience requires app version 1.0')
  if (env.BUILD_AUDIENCE === 'developer' && appVersion !== '0.1.0') errors.push('developer audience requires app version 0.1.0')
  if (!/^\d+$/.test(env.BUILD_NUMBER ?? '')) errors.push('build number must contain digits only')

  return {
    errors,
    provenance: {
      schemaVersion: RELEASE_PROVENANCE_SCHEMA,
      audience: env.BUILD_AUDIENCE,
      sourceRef: env.GITHUB_REF,
      sourceSha: env.GITHUB_SHA,
      checkoutSha: env.CHECKOUT_SHA,
      workflowSha: env.GITHUB_WORKFLOW_SHA,
      expectedSourceSha: env.EXPECTED_SOURCE_SHA || null,
      appVersion,
      buildNumber: env.BUILD_NUMBER,
      publicPolicy: policy,
    },
  }
}

function main() {
  const root = process.cwd()
  const target = resolve(root, process.argv[2] ?? 'dist')
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    console.error(`release package directory is missing: ${target}`)
    process.exit(1)
  }
  const result = createReleaseProvenance({ root, target, env: process.env })
  if (result.errors.length) {
    console.error('RELEASE PACKAGE STAMP FAILED')
    for (const error of result.errors) console.error(`- ${error}`)
    process.exit(1)
  }
  const path = join(target, RELEASE_PROVENANCE_FILE)
  writeFileSync(path, `${JSON.stringify(result.provenance, null, 2)}\n`)
  console.log(`Release provenance stamped: ${basename(target)}/${RELEASE_PROVENANCE_FILE}`)
  console.log(`audience=${result.provenance.audience} source=${result.provenance.sourceSha} workflow=${result.provenance.workflowSha}`)
}

const invoked = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
if (invoked) main()
