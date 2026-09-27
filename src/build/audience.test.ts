import { describe, expect, it } from 'vitest'
import {
  audienceAllowsLearnerPreview,
  audienceEnablesDeveloperTools,
  audienceEnablesFeedbackTravel,
} from './audience'

describe('build audience release policy', () => {
  it('keeps every public-only escape hatch closed for normal builds', () => {
    expect(audienceEnablesDeveloperTools('normal')).toBe(false)
    expect(audienceEnablesFeedbackTravel('normal')).toBe(false)
    expect(audienceAllowsLearnerPreview('normal')).toBe(false)
  })

  it('keeps internal capabilities explicitly separated', () => {
    expect(audienceEnablesDeveloperTools('developer')).toBe(true)
    expect(audienceEnablesFeedbackTravel('developer')).toBe(false)
    expect(audienceEnablesDeveloperTools('feedback')).toBe(false)
    // Settings' developer sections (on-device Gemma among them) follow this too.
    expect(audienceEnablesDeveloperTools('open-source')).toBe(false)
    expect(audienceEnablesDeveloperTools('web-demo')).toBe(false)
    expect(audienceEnablesFeedbackTravel('feedback')).toBe(true)
    expect(audienceAllowsLearnerPreview('developer')).toBe(true)
    expect(audienceAllowsLearnerPreview('feedback')).toBe(true)
  })
})
