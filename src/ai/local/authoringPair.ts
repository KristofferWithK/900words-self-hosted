import type { MatrixFile } from './evaluator'

export type AuthoringPair = readonly [string, string]

const MODEL_NAME = /^[a-z][a-z0-9_]*$/

/**
 * The cross-model instrument follows the authors recorded by this city. There
 * is deliberately no fallback: an authored non-default city must never be
 * reconstructed from the historic Opus/Fable halves by accident.
 */
export function authoringPairFromMatrix(
  matrix: Pick<MatrixFile, 'city' | 'meta'>,
): AuthoringPair {
  const judges = matrix.meta?.judges
  if (!Array.isArray(judges) || judges.length !== 2) {
    throw new Error(`city ${matrix.city} matrix must record exactly two judges`)
  }
  const [first, second] = judges
  if (
    typeof first !== 'string' ||
    typeof second !== 'string' ||
    !MODEL_NAME.test(first) ||
    !MODEL_NAME.test(second)
  ) {
    throw new Error(`city ${matrix.city} matrix judges must be lowercase filename-safe names`)
  }
  if (first === second) throw new Error(`city ${matrix.city} matrix judges must be different`)
  return [first, second]
}

export function displayModel(model: string): string {
  return model.charAt(0).toUpperCase() + model.slice(1)
}
