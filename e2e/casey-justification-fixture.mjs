// Keep the following turn outside the justification measurement.
export async function holdNextClue(route, context) {
  // A 503 completes the request and mounts GameScreen's error banner during
  // the previous guess's held REVEAL. Leave this intercepted route untouched:
  // context.close() cancels the request after all beat/geometry assertions.
  await new Promise((resolve) => context.once('close', resolve))
}
