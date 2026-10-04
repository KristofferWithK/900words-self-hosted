import { fileURLToPath } from 'node:url'

export const IOS_1_0_RELEASE_REF = 'refs/heads/release/ios-1.0'
export const CAFE_WORLD_INTEGRATION_REF = 'refs/heads/integration/cafe-world'

/**
 * The only refs a normal-audience (store-like, version 1.0) build may come from.
 * The café line is here by the owner's decision of 4 October 2026: a store-like
 * build of the café world for internal TestFlight testing while 1.0 is in App
 * Review. A café-line build is never an App Store submission candidate. Every
 * other normal-audience rule (explicit expected SHA, source/workflow/checkout
 * SHA equality) applies to both refs alike.
 */
export const NORMAL_AUDIENCE_REFS = Object.freeze([IOS_1_0_RELEASE_REF, CAFE_WORLD_INTEGRATION_REF])
const SHA = /^[0-9a-f]{40}$/i
const AUDIENCES = new Set(['developer', 'normal', 'open-source'])

/**
 * Pure policy for a TestFlight dispatch. Keep it independent of GitHub Actions
 * so every unsafe audience/ref/SHA combination can be exercised locally.
 */
export function validateTestflightDispatch({
  audience,
  sourceRef,
  sourceSha,
  checkoutSha,
  workflowSha,
  expectedSourceSha = '',
}) {
  const errors = []
  if (!AUDIENCES.has(audience)) errors.push(`unsupported audience ${JSON.stringify(audience)}`)
  if (!SHA.test(sourceSha ?? '')) errors.push('source SHA must be a full 40-character commit SHA')
  if (!SHA.test(checkoutSha ?? '')) errors.push('checkout SHA must be a full 40-character commit SHA')
  if (!SHA.test(workflowSha ?? '')) errors.push('workflow SHA must be a full 40-character commit SHA')
  if (SHA.test(sourceSha ?? '') && SHA.test(checkoutSha ?? '') && sourceSha.toLowerCase() !== checkoutSha.toLowerCase()) {
    errors.push('checked-out commit does not match the workflow source SHA')
  }

  if (audience === 'normal') {
    if (!NORMAL_AUDIENCE_REFS.includes(sourceRef)) {
      errors.push(`normal audience requires one of ${NORMAL_AUDIENCE_REFS.join(', ')}`)
    }
    if (!SHA.test(expectedSourceSha)) {
      errors.push('normal audience requires an explicit full expected source SHA')
    } else {
      if (SHA.test(sourceSha ?? '') && expectedSourceSha.toLowerCase() !== sourceSha.toLowerCase()) {
        errors.push('expected source SHA does not match the workflow source SHA')
      }
      if (SHA.test(workflowSha ?? '') && expectedSourceSha.toLowerCase() !== workflowSha.toLowerCase()) {
        errors.push('expected source SHA does not match the workflow definition SHA')
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    evidence: {
      audience,
      sourceRef,
      sourceSha,
      checkoutSha,
      workflowSha,
      expectedSourceSha: expectedSourceSha || null,
    },
  }
}

function main() {
  const result = validateTestflightDispatch({
    audience: process.env.BUILD_AUDIENCE,
    sourceRef: process.env.GITHUB_REF,
    sourceSha: process.env.GITHUB_SHA,
    checkoutSha: process.env.CHECKOUT_SHA,
    workflowSha: process.env.GITHUB_WORKFLOW_SHA,
    expectedSourceSha: process.env.EXPECTED_SOURCE_SHA,
  })
  if (!result.ok) {
    console.error('TESTFLIGHT DISPATCH GUARD FAILED')
    for (const error of result.errors) console.error(`- ${error}`)
    process.exit(1)
  }
  const evidence = result.evidence
  console.log(`TestFlight dispatch guard OK: ${evidence.audience} from ${evidence.sourceRef}`)
  console.log(`source=${evidence.sourceSha} checkout=${evidence.checkoutSha} workflow=${evidence.workflowSha}`)
  if (evidence.expectedSourceSha) console.log(`approved=${evidence.expectedSourceSha}`)
}

const invoked = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false
if (invoked) main()
