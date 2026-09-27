import { describe, expect, it } from 'vitest'
import {
  DiagnosticRoundEventSchema,
  LearningRoundEventSchema,
  buildRoundDataEvent,
  type RoundDataSource,
} from './schema'

const source: RoundDataSource = {
  eventId: 'event_12345678',
  at: 1_777_000_000_000,
  language: 'da',
  cityIndex: 0,
  mode: 'wrapup',
  result: 'won',
  reason: 'all-green',
  boardSize: 18,
  lookedUpCount: 2,
  packedCount: 10,
  wrappedCount: 8,
  newlyLearnedCount: 1,
  newlyDiscoveredCount: 0,
  clues: [{
    by: 'player',
    text: 'warm places',
    number: 2,
    guesses: [{ wordId: 'da:sol', result: 'green' }],
  }],
}

describe('H10 data-sharing schemas', () => {
  it('diagnostics contain counts and outcomes but no clue, guess or word content', () => {
    const event = buildRoundDataEvent('diagnostics', source)
    expect(event).toMatchObject({ sharing: 'diagnostics', turns: 1, wrappedCount: 8 })
    expect(JSON.stringify(event)).not.toContain('warm places')
    expect(JSON.stringify(event)).not.toContain('da:sol')
    expect(event).not.toHaveProperty('examples')
  })

  it('the learning choice adds only the named clue, guesses and outcomes', () => {
    const event = buildRoundDataEvent('learning', source)
    expect(event).toMatchObject({
      sharing: 'learning',
      examples: [{ by: 'player', clue: 'warm places', number: 2 }],
    })
  })

  it('rejects content fields smuggled into anonymous diagnostics', () => {
    const event = buildRoundDataEvent('diagnostics', source)
    expect(DiagnosticRoundEventSchema.safeParse({ ...event, examples: [] }).success).toBe(false)
    expect(DiagnosticRoundEventSchema.safeParse({ ...event, clue: 'secret' }).success).toBe(false)
  })

  it('rejects unknown learning fields and out-of-contract content', () => {
    const event = buildRoundDataEvent('learning', source)
    if (event.sharing !== 'learning') throw new Error('learning builder returned diagnostics')
    expect(LearningRoundEventSchema.safeParse({ ...event, email: 'somebody@example.com' }).success).toBe(false)
    expect(
      LearningRoundEventSchema.safeParse({
        ...event,
        examples: [{ ...event.examples[0], guesses: [{ wordId: 'da:sol', result: 'fatal' }] }],
      }).success,
    ).toBe(false)
  })
})
