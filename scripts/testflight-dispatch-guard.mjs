import { fileURLToPath } from 'node:url'

export const IOS_1_0_RELEASE_REF = 'refs/heads/release/ios-1.0'
const SHA = /^[0-9a-f]{40}$/i
const AUDIENCES = new Set(['developer', 'normal'])

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
    if (sourceRef !== IOS_1_0_RELEASE_REF) {
      errors.push(`normal audience requires ${IOS_1_0_RELEASE_REF}`)
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
