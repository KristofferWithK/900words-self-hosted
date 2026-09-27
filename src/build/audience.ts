/**
 * The audience is selected only when the bundle is made. It is intentionally
 * not a setting, URL parameter, or entitlement: feedback access belongs to a
 * build handed to invited testers, while StoreKit remains the authority for a
 * future paid build.
 */
export type BuildAudience = 'normal' | 'feedback' | 'developer' | 'open-source' | 'web-demo'

/**
 * A deliberately unmistakable value in the compiled bundle. The release
 * package gate checks this marker against the provenance file that is copied
 * into both `dist` and Capacitor's staged public tree. Deriving the audience
 * from the marker keeps it live: a minifier cannot discard the evidence while
 * retaining the audience-dependent code.
 */
// Offline validators load source through a deliberately config-free Vite
// server. They do not receive `define.__BUILD_AUDIENCE__`, so use the same
// normal-audience default as vite.config.ts there. Bundled builds still replace
// the constant before this branch can matter.
const compiledAudience: BuildAudience =
  typeof __BUILD_AUDIENCE__ === 'undefined' ? 'normal' : __BUILD_AUDIENCE__

export const buildAudienceStamp =
  compiledAudience === 'normal'
    ? '__900WORDS_BUILD_AUDIENCE__:normal'
    : compiledAudience === 'feedback'
      ? '__900WORDS_BUILD_AUDIENCE__:feedback'
      : compiledAudience === 'open-source'
        ? '__900WORDS_BUILD_AUDIENCE__:open-source'
        : compiledAudience === 'web-demo'
          ? '__900WORDS_BUILD_AUDIENCE__:web-demo'
          : '__900WORDS_BUILD_AUDIENCE__:developer'

export const buildAudience = buildAudienceStamp.split(':').at(-1) as BuildAudience

/** Invited feedback testers earn the route; they do not receive a pass. */
export function audienceEnablesFeedbackTravel(audience: BuildAudience): boolean {
  return audience === 'feedback'
}

export function feedbackTravelAllowed(audience: BuildAudience = buildAudience): boolean {
  return audienceEnablesFeedbackTravel(audience)
}

/** Kristoffer's jump control is an inspection tool, never tester access. */
export function audienceEnablesDeveloperTools(audience: BuildAudience): boolean {
  return audience === 'developer'
}

export function developerTravelToolsAllowed(audience: BuildAudience = buildAudience): boolean {
  return import.meta.env.DEV || audienceEnablesDeveloperTools(audience)
}

/**
 * The website's playable intro (900words.app/play/): the real onboarding,
 * served without a service worker, kept entirely in memory, and talking to
 * the website's own hardened Casey. See src/webdemo/.
 */
export function isWebDemo(audience: BuildAudience = buildAudience): boolean {
  return audience === 'web-demo'
}

/** Public 1.0 must not offer an unfinished learner course. */
export function audienceAllowsLearnerPreview(audience: BuildAudience = buildAudience): boolean {
  return audience !== 'normal'
}
