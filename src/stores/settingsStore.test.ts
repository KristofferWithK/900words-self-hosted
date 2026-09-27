import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_BASE_URL } from '../ai/client'
import { migrateSettings, useSettings } from './settingsStore'

describe('settingsStore: Casey is a server decision service', () => {
  beforeEach(() => {
    useSettings.setState({
      baseUrl: DEFAULT_BASE_URL,
      caseyMode: 'worker',
      useMock: false,
      sound: true,
      playExampleOnLookup: true,
      dailyReminders: false,
      playtestTravel: false,
      dataSharing: null,
      dataSharingPromptShownAt: null,
      klausVerifiedAt: null,
    })
  })

  it('stores a Casey boundary but no credential or raw server-model choice', () => {
    const initial = useSettings.getInitialState() as unknown as Record<string, unknown>
    expect(initial.baseUrl).toBe(DEFAULT_BASE_URL)
    expect(initial).not.toHaveProperty('apiKey')
    expect(initial).not.toHaveProperty('model')
  })

  it('re-arms the connection check only when the service changes', () => {
    useSettings.getState().markClueyVerified(123)
    useSettings.getState().set({ sound: false })
    expect(useSettings.getState().klausVerifiedAt).toBe(123)
    useSettings.getState().set({ baseUrl: 'https://other.example/v1' })
    expect(useSettings.getState().klausVerifiedAt).toBeNull()
  })

  it('re-arms the check when Casey moves between the Worker and this iPhone', () => {
    useSettings.setState({ useMock: true })
    useSettings.getState().markClueyVerified(234)
    useSettings.getState().set({ caseyMode: 'gemma4-e4b' })
    expect(useSettings.getState().klausVerifiedAt).toBeNull()
    expect(useSettings.getState().useMock).toBe(false)
  })

  it('does not re-arm when the same service value is written again', () => {
    useSettings.getState().markClueyVerified(456)
    useSettings.getState().set({ baseUrl: DEFAULT_BASE_URL })
    expect(useSettings.getState().klausVerifiedAt).toBe(456)
  })

  it('keeps the measured defaults for fresh installs', () => {
    expect(useSettings.getInitialState()).toMatchObject({
      baseUrl: DEFAULT_BASE_URL,
      caseyMode: 'worker',
      useMock: false,
      sound: true,
      playExampleOnLookup: true,
      dailyReminders: false,
      playtestTravel: false,
      dataSharing: null,
      dataSharingPromptShownAt: null,
      klausVerifiedAt: null,
    })
  })
})

describe('settingsStore v16 migration', () => {
  it.each([1, 6, 7, 9, 10])('removes secrets and model names from a v%i save', (from) => {
    const migrated = migrateSettings(
      {
        apiKey: 'sk-secret-that-must-not-survive',
        model: 'client-selected-model',
        baseUrl: 'https://custom-casey.example/v1',
        useMock: true,
      },
      from,
    ) as Record<string, unknown>
    expect(migrated).not.toHaveProperty('apiKey')
    expect(migrated).not.toHaveProperty('model')
    expect(migrated.baseUrl).toBe('https://custom-casey.example/v1')
    expect(migrated.useMock).toBe(false)
  })

  it('clears the mock flag saved by the affected TestFlight build', () => {
    const migrated = migrateSettings(
      { baseUrl: DEFAULT_BASE_URL, caseyMode: 'gemma4-e4b', useMock: true },
      15,
    ) as Record<string, unknown>
    // v19 then turns that Gemma choice into offline mode (below).
    expect(migrated).toMatchObject({ caseyMode: 'worker', offlineMode: true, useMock: false })
  })

  it('does not rewrite an already-current save', () => {
    const current = {
      baseUrl: DEFAULT_BASE_URL,
      caseyMode: 'worker',
      offlineMode: false,
      sound: false,
      playExampleOnLookup: false,
    }
    expect(migrateSettings(current, 19)).toBe(current)
  })

  it('turns the anonymous usage counters on for every save written before they existed (v17)', () => {
    // The trap CLAUDE.md's point 3 names: a new default does nothing for a
    // device that already stored a settings blob unless the migration writes it.
    expect((migrateSettings({ sound: true }, 16) as Record<string, unknown>).usageStats).toBe(true)
    expect((migrateSettings({ sound: true }, 3) as Record<string, unknown>).usageStats).toBe(true)
    // A choice made under v17 or later is a choice, and stays.
    expect((migrateSettings({ usageStats: false }, 18) as Record<string, unknown>).usageStats).toBe(false)
    const chosen = { usageStats: false }
    expect(migrateSettings(chosen, 19)).toBe(chosen)
  })

  it('keeps every existing phone on the proven Worker until Gemma is chosen', () => {
    expect(migrateSettings({ caseyMode: 'gemma4-e4b' }, 14)).toMatchObject({ caseyMode: 'worker', offlineMode: false })
  })

  it('turns a phone that chose Gemma into offline mode, with normal Casey whenever she can play (v19)', () => {
    expect(migrateSettings({ caseyMode: 'gemma4-e4b' }, 15)).toMatchObject({ caseyMode: 'worker', offlineMode: true })
    expect(migrateSettings({ caseyMode: 'gemma4-e4b' }, 18)).toMatchObject({ caseyMode: 'worker', offlineMode: true })
  })

  it('writes offline mode off into every other save rather than leaving it to the merge (v19)', () => {
    expect(migrateSettings({ caseyMode: 'worker' }, 18)).toMatchObject({ caseyMode: 'worker', offlineMode: false })
    const current = { caseyMode: 'gemma4-e4b', offlineMode: false }
    expect(migrateSettings(current, 19)).toBe(current)
  })

  it('never infers notification consent from a pre-reminder save', () => {
    expect((migrateSettings({ dailyReminders: true }, 11) as Record<string, unknown>).dailyReminders).toBe(false)
    expect((migrateSettings({ dailyReminders: true }, 12) as Record<string, unknown>).dailyReminders).toBe(true)
  })

  it('never turns on TestFlight travel from a pre-v13 save', () => {
    expect((migrateSettings({ playtestTravel: true }, 12) as Record<string, unknown>).playtestTravel).toBe(false)
    expect((migrateSettings({ playtestTravel: true }, 13) as Record<string, unknown>).playtestTravel).toBe(true)
  })

  it('never infers optional data consent or a shown prompt from an older save', () => {
    expect(
      migrateSettings(
        { dataSharing: 'learning', dataSharingPromptShownAt: 123 },
        13,
      ),
    ).toMatchObject({ dataSharing: null, dataSharingPromptShownAt: null })
    expect(
      migrateSettings({ dataSharing: 'diagnostics', dataSharingPromptShownAt: 456 }, 14),
    ).toMatchObject({ dataSharing: 'diagnostics', dataSharingPromptShownAt: 456 })
  })

  it('still composes the old default fixes on the way to v11', () => {
    const migrated = migrateSettings(
      {
        studyPhase: 'auto',
        clueLanguage: 'en',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: '',
      },
      1,
    ) as Record<string, unknown>
    expect(migrated).toMatchObject({
      baseUrl: DEFAULT_BASE_URL,
      sound: true,
      useMock: false,
      playExampleOnLookup: true,
    })
    expect(migrated).not.toHaveProperty('studyPhase')
  })

  it('preserves sound and service choices while retiring study phase', () => {
    const migrated = migrateSettings(
      {
        studyPhase: 'always',
        sound: false,
        baseUrl: 'https://my-casey.example/v1',
      },
      10,
    ) as Record<string, unknown>
    expect(migrated).toMatchObject({
      sound: false,
      baseUrl: 'https://my-casey.example/v1',
      playExampleOnLookup: true,
    })
    expect(migrated).not.toHaveProperty('studyPhase')
  })

  describe('the older persisted-default corrections still compose', () => {
    it('retires the old study preference from every saved version', () => {
      for (const from of [1, 2, 17]) {
        const migrated = migrateSettings({ studyPhase: 'always' }, from) as Record<string, unknown>
        expect(migrated).not.toHaveProperty('studyPhase')
      }
    })

    it('adds lookup-sentence audio without overriding a choice made under v18', () => {
      expect((migrateSettings({}, 17) as Record<string, unknown>).playExampleOnLookup).toBe(true)
      expect(
        (migrateSettings({ playExampleOnLookup: false }, 18) as Record<string, unknown>)
          .playExampleOnLookup,
      ).toBe(false)
    })

    it('leaves the retired clue-language orphan alone because nothing reads it', () => {
      // Casey clues in the language being learned, full stop (owner,
      // 2026-09-11), so the setting is gone. Like gridSize below, the value an
      // old save carries is neither rewritten nor removed: partialize never
      // writes it back, and no reader is left to be confused by it.
      for (const [from, value] of [
        [2, 'en'],
        [3, 'en'],
        [8, 'da'],
        [17, 'target'],
      ] as const) {
        expect(
          (migrateSettings({ clueLanguage: value }, from) as Record<string, unknown>).clueLanguage,
          `from v${from}`,
        ).toBe(value)
      }
      expect(useSettings.getInitialState()).not.toHaveProperty('clueLanguage')
    })

    it('adds sound to pre-v8 saves without overriding a v8 choice', () => {
      expect((migrateSettings({}, 7) as Record<string, unknown>).sound).toBe(true)
      expect((migrateSettings({ sound: false }, 8) as Record<string, unknown>).sound).toBe(false)
    })

    it('leaves the retired board-size orphan alone because nothing reads it', () => {
      for (const from of [1, 4, 8, 10]) {
        expect(
          (migrateSettings({ gridSize: 'beginner' }, from) as Record<string, unknown>).gridSize,
          `from v${from}`,
        ).toBe('beginner')
      }
      expect(useSettings.getInitialState()).not.toHaveProperty('gridSize')
    })

    it('moves the old keyless Gemini default but preserves a deliberate service', () => {
      const gemini = 'https://generativelanguage.googleapis.com/v1beta/openai'
      expect(
        (migrateSettings({ baseUrl: gemini, apiKey: '' }, 4) as Record<string, unknown>).baseUrl,
      ).toBe(DEFAULT_BASE_URL)
      expect(
        (
          migrateSettings(
            { baseUrl: gemini, apiKey: 'old-user-key' },
            4,
          ) as Record<string, unknown>
        ).baseUrl,
      ).toBe(gemini)
      expect(
        (
          migrateSettings(
            { baseUrl: 'https://personal-casey.example/v1', apiKey: '' },
            4,
          ) as Record<string, unknown>
        ).baseUrl,
      ).toBe('https://personal-casey.example/v1')
    })

    it('forces every pre-v11 mock opt-in back to model-backed Casey', () => {
      for (const from of [1, 9, 10]) {
        expect((migrateSettings({ useMock: true }, from) as Record<string, unknown>).useMock).toBe(
          false,
        )
      }
    })

    it('accepts missing and undefined old saves', () => {
      expect(() => migrateSettings(undefined, 1)).not.toThrow()
      expect(() => migrateSettings({}, 10)).not.toThrow()
    })
  })
})
