import { describe, expect, it } from 'vitest'
import { TranslationResponseSchema } from './schemas'

describe('TranslationResponseSchema', () => {
  it('rejects provider metadata rather than silently carrying it into the client', () => {
    expect(
      TranslationResponseSchema.safeParse({
        da: 'helikopter',
        en: 'helicopter',
        provider: 'gemini-3.5-flash-lite',
      }).success,
    ).toBe(false)
  })
})
