/**
 * The historic authoring pair. Omitting `--models` must keep cities 1 and 2
 * reproducible, while a new city can opt into another pair explicitly.
 */
export const DEFAULT_MODEL_PAIR = Object.freeze(['opus', 'fable'])

const MODEL_NAME = /^[a-z][a-z0-9_]*$/

/** Validate a two-model pair while preserving its configured order. */
export function modelPair(value, label = 'model pair') {
  const models = typeof value === 'string' ? value.split(',').map((x) => x.trim()) : value
  if (!Array.isArray(models) || models.length !== 2) {
    throw new Error(`${label} must name exactly two models`)
  }
  for (const model of models) {
    if (typeof model !== 'string' || !MODEL_NAME.test(model)) {
      throw new Error(
        `${label} contains invalid model name ${JSON.stringify(model)}; use lowercase filename-safe names`,
      )
    }
  }
  if (models[0] === models[1]) throw new Error(`${label} must name two different models`)
  return Object.freeze([models[0], models[1]])
}

/** Read `--models first,second`, defaulting only for historic compatibility. */
export function modelPairFromArgs(argv) {
  const i = argv.indexOf('--models')
  if (i === -1) return DEFAULT_MODEL_PAIR
  const value = argv[i + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error('--models needs two comma-separated names, for example --models sol,terra')
  }
  return modelPair(value, '--models')
}

/** Fail when two pipeline stages disagree about who authored a city. */
export function assertSameModelPair(actual, expected, label) {
  if (actual[0] !== expected[0] || actual[1] !== expected[1]) {
    throw new Error(
      `${label} is ${expected.join(',')}, but --models resolved to ${actual.join(',')}; ` +
        `pass --models ${expected.join(',')}`,
    )
  }
}
