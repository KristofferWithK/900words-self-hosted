import { describe, expect, it } from 'vitest'
import { CITIES } from '../journey/cities'
import { newStats } from '../srs/scheduler'
import { validatedReceiptFixture } from '../progression/fixtures'
import type { SrsMap, WordStats } from '../srs/types'
import {
  BACKUP_FORMAT,
  betterRecord,
  buildBackup,
  mergeSnapshot,
  mergeWordRecord,
  parseBackup,
  replaceSnapshot,
  summarize,
  type Snapshot,
} from './backup'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

const stats = (patch: Partial<WordStats> = {}): WordStats => ({ ...newStats(NOW), ...patch })

/** One green each way — the collected threshold. */
const COLLECTED: Partial<WordStats> = { greenByClue: 1, greenByGuess: 1, correctGuesses: 2 }

const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({
  stats: {},
  games: { played: 0, won: 0, redeemed: 0, lost: 0 },
  translationPostcards: 0,
  journey: { cityIndex: 0, wrapped: {}, arrivedAt: {} },
  prefs: {},
  language: 'da',
  ...patch,
})

const roundTrip = (s: Snapshot) => {
  const parsed = parseBackup(JSON.stringify(buildBackup(s, NOW)))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.backup
}

describe('export and parse', () => {
  it('carries every settled round in full for research, and reads a file without them', () => {
    const entry = Object.values(validatedReceiptFixture().ledger.settlements)[0]!
    expect(roundTrip(snapshot({ history: [entry] })).history).toEqual([JSON.parse(JSON.stringify(entry))])
    expect(roundTrip(snapshot()).history).toEqual([])
    const older = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW)))
    delete older.history
    const read = parseBackup(JSON.stringify(older))
    expect(read.ok && read.backup.history).toEqual([])
    const junk = JSON.parse(JSON.stringify(buildBackup(snapshot({ history: [entry] }), NOW)))
    junk.history[0].receipt.attemptTier = 'diamond'
    expect(parseBackup(JSON.stringify(junk)).ok).toBe(false)
  })

  it('preserves unspent translation postcards through export and replace', () => {
    const file = roundTrip(snapshot({ translationPostcards: 7 }))
    expect(file.srs.translationPostcards).toBe(7)
    expect(summarize(file).translationPostcards).toBe(7)
    expect(replaceSnapshot(file).translationPostcards).toBe(7)
  })

  it('merges postcard balances without adding the same reward twice', () => {
    const file = roundTrip(snapshot({ translationPostcards: 7 }))
    const once = mergeSnapshot(snapshot({ translationPostcards: 3 }), file)
    expect(once.translationPostcards).toBe(7)
    expect(mergeSnapshot(once, file).translationPostcards).toBe(7)
  })

  it('reads an older export without inventing a postcard balance', () => {
    const old = buildBackup(snapshot({ games: { played: 12, won: 9, lost: 3, redeemed: 0 } }), NOW)
    delete (old.srs as { translationPostcards?: number }).translationPostcards
    const parsed = parseBackup(JSON.stringify(old))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(replaceSnapshot(parsed.backup).translationPostcards).toBe(0)
  })

  /**
   * The pre-rename field. Every export written before the postcard change
   * carries `translationJokers`; the schema reads it 1:1 so a real file from
   * an older build restores its balance instead of refusing it — and the
   * retired key is dropped on the read, so it cannot leak back into state.
   */
   it('reads the retired joker key as the same balance, and drops the old name', () => {
     const pre = buildBackup(snapshot(), NOW)
     const preSrs = { ...pre.srs } as Record<string, unknown>
     delete preSrs.translationPostcards
     preSrs.translationJokers = 5
     // An actual pre-rename file is format 2. Format 3 totals are derived
     // display data and must never be reinterpreted as another legacy grant.
     const legacy = { ...pre, format: 2, srs: preSrs }
     const parsed = parseBackup(JSON.stringify(legacy))
     expect(parsed.ok).toBe(true)
     if (!parsed.ok) return
     expect(parsed.backup.srs.translationPostcards).toBe(5)
     expect(JSON.stringify(parsed.backup)).not.toContain('translationJokers')
     expect(replaceSnapshot(parsed.backup).translationPostcards).toBe(5)
   })

  it('the new name wins when a file somehow carries both balances', () => {
    const file = buildBackup(snapshot(), NOW)
    const merged = JSON.parse(JSON.stringify(file))
    merged.format = 2
    merged.srs.translationJokers = 9
    merged.srs.translationPostcards = 4
    const parsed = parseBackup(JSON.stringify(merged))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.srs.translationPostcards).toBe(4)
  })

  it('rejects invalid postcard balances', () => {
    for (const translationPostcards of [-1, 1.5, '3', null]) {
      const file = buildBackup(snapshot(), NOW)
      expect(parseBackup(JSON.stringify({ ...file, srs: { ...file.srs, translationPostcards } })).ok).toBe(false)
    }
  })

  it('survives a round trip through JSON', () => {
    const s = snapshot({
      stats: { hus: stats({ correctGuesses: 2, seen: 4, box: 3 }) },
      games: { played: 9, won: 4, redeemed: 1, lost: 4 },
      journey: {
        cityIndex: 2,
        wrapped: { hus: NOW - DAY },
        arrivedAt: { 1: NOW - 5 * DAY, 2: NOW - DAY },
      },
    })
    const back = roundTrip(s)
    expect(back.format).toBe(BACKUP_FORMAT)
    expect(back.srs.stats.hus).toEqual(s.stats.hus)
    expect(back.journey.wrapped).toEqual({ hus: NOW - DAY })
    expect(back.journey.cityIndex).toBe(2)
    expect(back.srs.games.played).toBe(9)
  })

  /**
   * Travel back leaves the traveller behind the furthest stop they reached,
   * and a file has to carry that or a restore locks every city past where
   * they happen to be standing. A position that never travelled back writes
   * no key at all, so its file is byte-identical to one from before the
   * field existed — and a merge keeps the furthest of both sides.
   */
  it('carries the furthest stop reached, and only when it is past the position', () => {
    const wentBack = snapshot({ journey: { cityIndex: 1, wrapped: {}, arrivedAt: {}, furthest: 4 } })
    expect(roundTrip(wentBack).journey.furthest).toBe(4)
    expect(replaceSnapshot(roundTrip(wentBack)).journey.furthest).toBe(4)
    const neverDid = snapshot({ journey: { cityIndex: 3, wrapped: {}, arrivedAt: {}, furthest: 0 } })
    expect(JSON.stringify(buildBackup(neverDid, NOW))).not.toContain('furthest')
    expect(replaceSnapshot(roundTrip(neverDid)).journey.furthest).toBeUndefined()
    const merged = mergeSnapshot(
      snapshot({ journey: { cityIndex: 2, wrapped: {}, arrivedAt: {}, furthest: 0 } }),
      roundTrip(wentBack),
    )
    expect(merged.journey.cityIndex).toBe(2)
    expect(merged.journey.furthest).toBe(4)
  })

  it('never carries the API key, whatever is in the store', () => {
    const text = JSON.stringify(buildBackup(snapshot(), NOW))
    expect(text).not.toContain('apiKey')
    expect(text).not.toContain('baseUrl')
    // And the schema has no room for one to sneak in later.
    const parsed = parseBackup(JSON.stringify({ ...JSON.parse(text), apiKey: 'sk-secret' }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(JSON.stringify(parsed.backup)).not.toContain('sk-secret')
  })

  it('rejects junk with a message a person can act on', () => {
    expect(parseBackup('not json at all')).toMatchObject({ ok: false })
    expect(parseBackup('{"hello":"world"}')).toMatchObject({ ok: false })
    expect(parseBackup('[]')).toMatchObject({ ok: false })
    const notMine = parseBackup('{"hello":"world"}')
    if (!notMine.ok) expect(notMine.error).toContain('another app')
  })

  it('rejects a backup from a future version rather than half-reading it', () => {
    const future = { ...buildBackup(snapshot(), NOW), format: BACKUP_FORMAT + 1 }
    const parsed = parseBackup(JSON.stringify(future))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('newer version')
  })

  it('rejects a city index off the route, which a restore would write straight through', () => {
    // cityAt throws outside the route and the value goes into the store
    // unexamined, so this bound is the only thing between a bad file and a
    // permanently blank app.
    // Written against the route rather than against 9 and 10, because the
    // route got shorter once already and these numbers did not follow it.
    for (const bad of [99, -3, 10, 1.5]) {
      const file = buildBackup(snapshot(), NOW)
      file.journey.cityIndex = bad
      expect(parseBackup(JSON.stringify(file)).ok).toBe(false)
    }
    const good = buildBackup(snapshot(), NOW)
    good.journey.cityIndex = CITIES.length - 1
    expect(parseBackup(JSON.stringify(good)).ok).toBe(true)
  })

  it('clamps, rather than refuses, a stop from the ten-city route the file was written on', () => {
    // Before Viborg left the route København was index 9. A file exported
    // there is real progress and used to be refused as "not a 900words
    // backup"; it reads as the current final stop instead, which is the same
    // clamp the journey rescue applies and costs nothing (mergeJourney takes
    // the further of the two positions, and the index is only a floor).
    const file = buildBackup(snapshot(), NOW)
    file.journey.cityIndex = CITIES.length
    file.journey.furthest = CITIES.length
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.journey.cityIndex).toBe(CITIES.length - 1)
    expect(parsed.backup.journey.furthest).toBe(CITIES.length - 1)
  })

  it('reads and discards the retired study phase', () => {
    // Written as the raw file an old build produced: the type no longer admits it.
    const file = buildBackup(snapshot(), NOW)
    ;(file.prefs as Record<string, string>).studyPhase = 'auto'
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.prefs).toEqual({})
  })

  it('rejects an invalid legacy study phase', () => {
    // These are cast straight into settings, so a value outside the enum is a
    // broken device rather than a bad file. (`gridSize` was the third of these
    // and the loudest — a size that was not a real one made every new game
    // throw when it looked up its config. There are no sizes now, and no clue
    // language since 2026-09-11; what happens to the fields an old file still
    // carries is pinned below.)
    const file = { ...buildBackup(snapshot(), NOW), prefs: { studyPhase: 'sometimes' } }
    expect(parseBackup(JSON.stringify(file)).ok).toBe(false)
  })

  it('rejects a file whose word records are the wrong shape', () => {
    const bad = buildBackup(snapshot({ stats: { hus: stats() } }), NOW)
    // @ts-expect-error deliberately corrupting the record
    bad.srs.stats.hus.box = 9
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })

  /**
   * EVERY BACKUP FILE EVER WRITTEN CARRIES A `gridSize`, AND EVERY ONE OF THEM
   * STILL RESTORES.
   *
   * N1 deleted board sizes and dropped the field from `PrefsSchema`. The
   * schema comment used to warn that these prefs are ENUMERATED because they
   * are cast straight into settings — and a zod enum rejects hard, which is
   * exactly the failure mode this test exists to rule out. `z.object` STRIPS
   * unknown keys rather than rejecting them, so the retired field is read past
   * and dropped, and a file a player has kept for a year opens on a build that
   * has never heard of it.
   *
   * Checked with a whole file rather than a patched one: this is a
   * pre-N1 backup, format and all, exactly as `buildBackup` would have written
   * it while board sizes existed.
   */
  it('restores a backup written before N1, gridSize and all', () => {
    const preN1 = {
      app: 'cluecabulary',
      format: 2,
      exportedAt: NOW - DAY,
      language: 'da',
      srs: { stats: { hus: stats(COLLECTED) }, games: { played: 9, won: 5, redeemed: 1, lost: 3 } },
      journey: { cityIndex: 3, wrapped: { hus: NOW - DAY }, arrivedAt: { 3: NOW - DAY } },
      prefs: { gridSize: 'standard', clueLanguage: 'target', studyPhase: 'never' },
    }
    const parsed = parseBackup(JSON.stringify(preN1))
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
    if (!parsed.ok) return
    // The file opens, the progress is all there...
    expect(parsed.backup.journey.cityIndex).toBe(3)
    expect(parsed.backup.journey.wrapped).toEqual({ hus: NOW - DAY })
    expect(parsed.backup.srs.stats.hus).toMatchObject({ greenByClue: 1, greenByGuess: 1 })
    // ...and the retired preferences are gone rather than fatal.
    expect(parsed.backup.prefs).toEqual({})
    expect(parsed.backup.prefs).not.toHaveProperty('gridSize')
    expect(parsed.backup.prefs).not.toHaveProperty('clueLanguage')
    expect(replaceSnapshot(parsed.backup).prefs).toEqual({})
  })

  /**
   * A format-1 file is months of someone's progress. It restores upgraded in
   * memory: banked -> wrapped by the store-migration rule, stamps and spent
   * attempts dropped, counter-less records seeded like migrateSrs.
   */
  it('upgrades a format-1 file: banked words arrive wrapped', () => {
    const v1 = {
      app: 'cluecabulary',
      format: 1,
      exportedAt: NOW,
      srs: {
        stats: {
          learned: {
            box: 3,
            lastSeenAt: NOW,
            seen: 5,
            correctGuesses: 3,
            misses: 0,
            lookups: 0,
            redemptionRight: 0,
            redemptionWrong: 0,
          },
        },
        games: { played: 9, won: 4, redeemed: 1, lost: 4 },
      },
      journey: {
        cityIndex: 2,
        stamps: { 0: 5, 1: 5, 2: 1 },
        banked: { hus: NOW - DAY, kat: NOW },
        trialsSpent: { 2: 3 },
        arrivedAt: { 2: NOW - DAY },
      },
      prefs: { gridSize: 'middle', clueLanguage: 'target', studyPhase: 'never' },
    }
    const parsed = parseBackup(JSON.stringify(v1))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.backup.journey.wrapped).toEqual({ hus: NOW - DAY, kat: NOW })
      expect(parsed.backup.journey).not.toHaveProperty('stamps')
      // The legacy learned record restores collected, per the seeding rule.
      expect(parsed.backup.srs.stats.learned).toMatchObject({ greenByClue: 1, greenByGuess: 1 })
      // The board size this file chose is not a field any more. Stripped
      // rather than rejected — see 'a backup written before N1' below.
      expect(parsed.backup.prefs).not.toHaveProperty('gridSize')
    }
  })

  it('normalizes a counter-less current-format file with the migration seeding rule', () => {
    const file = buildBackup(
      snapshot({
        stats: {
          learned: stats({ correctGuesses: 3 }),
          part: stats({ correctGuesses: 2 }),
        },
      }),
      NOW,
    )
    const json = JSON.parse(JSON.stringify(file)) as {
      srs: { stats: Record<string, Record<string, number>> }
    }
    delete json.srs.stats.learned!.greenByClue
    delete json.srs.stats.learned!.greenByGuess
    delete json.srs.stats.part!.greenByClue
    delete json.srs.stats.part!.greenByGuess
    const parsed = parseBackup(JSON.stringify(json))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.backup.srs.stats.learned).toMatchObject({ greenByClue: 1, greenByGuess: 1 })
      expect(parsed.backup.srs.stats.part).toMatchObject({ greenByClue: 0, greenByGuess: 0 })
    }
  })
})

describe('betterRecord', () => {
  it('collectedness outranks raw greens — a merge must never un-collect', () => {
    // Three greens all earned one way against a green each way: the second
    // record is the collected one, whatever the totals say. Mutation check:
    // put correctGuesses back in front and this fails.
    const oneWay = stats({ correctGuesses: 3, greenByClue: 3, greenByGuess: 0, seen: 9 })
    const eachWay = stats({ correctGuesses: 2, greenByClue: 1, greenByGuess: 1, seen: 2 })
    expect(betterRecord(oneWay, eachWay)).toBe(eachWay)
    expect(betterRecord(eachWay, oneWay)).toBe(eachWay)
  })

  it('prefers the record that knows the word better at equal collectedness', () => {
    const weak = stats({ correctGuesses: 1, greenByGuess: 1, seen: 9 })
    const strong = stats({ correctGuesses: 3, greenByGuess: 3, seen: 3 })
    expect(betterRecord(weak, strong)).toBe(strong)
    expect(betterRecord(strong, weak)).toBe(strong)
  })

  it('falls back to more history, then to more recent', () => {
    const seenMore = stats({ correctGuesses: 2, seen: 8 })
    const seenLess = stats({ correctGuesses: 2, seen: 2 })
    expect(betterRecord(seenLess, seenMore)).toBe(seenMore)

    const older = stats({ correctGuesses: 2, seen: 2, lastSeenAt: NOW - DAY })
    const newer = stats({ correctGuesses: 2, seen: 2, lastSeenAt: NOW })
    expect(betterRecord(older, newer)).toBe(newer)
  })

  it('returns a whole record, never a blend of two', () => {
    const a = stats({ correctGuesses: 3, greenByClue: 2, greenByGuess: 1, seen: 3, box: 4 })
    const b = stats({ correctGuesses: 1, seen: 20, misses: 12, box: 0 })
    expect(betterRecord(a, b)).toEqual(a)
  })
})

describe('merge', () => {
  it('cannot un-collect a word — in either direction', () => {
    const collected = stats(COLLECTED)
    const grey = stats({ correctGuesses: 1 })

    const fromFile = mergeSnapshot(
      snapshot({ stats: { hus: grey } }),
      roundTrip(snapshot({ stats: { hus: collected } })),
    )
    expect(fromFile.stats.hus).toMatchObject({ greenByClue: 1, greenByGuess: 1 })

    const onDevice = mergeSnapshot(
      snapshot({ stats: { hus: collected } }),
      roundTrip(snapshot({ stats: { hus: grey } })),
    )
    expect(onDevice.stats.hus).toMatchObject({ greenByClue: 1, greenByGuess: 1 })
  })

  it('keeps a clue mark on one side and a guess mark on the other, in both directions', () => {
    // Review of PR #350: the file's record wins on correctGuesses, and as a
    // whole record it would drop the device's clue mark. The two directional
    // counters are add-only, so each takes the larger side.
    const clueOnDevice = stats({ greenByClue: 1, greenByGuess: 0, correctGuesses: 1, seen: 1 })
    const guessInFile = stats({ greenByClue: 0, greenByGuess: 1, correctGuesses: 2, seen: 4, box: 3 })
    for (const [device, file] of [[clueOnDevice, guessInFile], [guessInFile, clueOnDevice]] as const) {
      const merged = mergeSnapshot(snapshot({ stats: { hus: device } }), roundTrip(snapshot({ stats: { hus: file } }))).stats.hus!
      expect(merged).toMatchObject({ greenByClue: 1, greenByGuess: 1 })
      // Every other field is the chosen record's own: still no blend there.
      expect({ ...merged, greenByClue: 0, greenByGuess: 0 }).toEqual({ ...guessInFile, greenByClue: 0, greenByGuess: 0 })
    }
    // Merging the result again changes nothing.
    const once = mergeSnapshot(snapshot({ stats: { hus: clueOnDevice } }), roundTrip(snapshot({ stats: { hus: guessInFile } })))
    expect(mergeSnapshot(once, roundTrip(snapshot({ stats: { hus: guessInFile } }))).stats.hus).toEqual(once.stats.hus)
  })

  it('takes the larger count of each side, not only the mark', () => {
    const a = stats({ greenByClue: 3, greenByGuess: 1, correctGuesses: 4 })
    const b = stats({ greenByClue: 1, greenByGuess: 2, correctGuesses: 5 })
    expect(mergeWordRecord(a, b)).toMatchObject({ greenByClue: 3, greenByGuess: 2, correctGuesses: 5 })
    expect(mergeWordRecord(b, a)).toMatchObject({ greenByClue: 3, greenByGuess: 2, correctGuesses: 5 })
    // When the chosen record already holds the larger counts it is returned as is.
    const full = stats({ greenByClue: 2, greenByGuess: 2, correctGuesses: 4 })
    expect(mergeWordRecord(full, stats({ greenByClue: 1, greenByGuess: 1, correctGuesses: 2 }))).toBe(full)
  })

  it('keeps words that exist on only one side', () => {
    const merged = mergeSnapshot(
      snapshot({ stats: { hus: stats({ seen: 1 }) } }),
      roundTrip(snapshot({ stats: { kat: stats({ seen: 1 }) } })),
    )
    expect(Object.keys(merged.stats).sort()).toEqual(['hus', 'kat'])
  })

  it('unions wrapped words and keeps the first time each was packed', () => {
    const merged = mergeSnapshot(
      snapshot({ journey: { cityIndex: 0, arrivedAt: {}, wrapped: { hus: NOW } } }),
      roundTrip(
        snapshot({
          journey: { cityIndex: 0, arrivedAt: {}, wrapped: { hus: NOW - DAY, kat: NOW } },
        }),
      ),
    )
    expect(merged.journey.wrapped).toEqual({ hus: NOW - DAY, kat: NOW })
  })

  it('takes the furthest city', () => {
    const merged = mergeSnapshot(
      snapshot({ journey: { cityIndex: 1, wrapped: {}, arrivedAt: {} } }),
      roundTrip(snapshot({ journey: { cityIndex: 3, wrapped: {}, arrivedAt: {} } })),
    )
    expect(merged.journey.cityIndex).toBe(3)
  })

  it('restoring your own file twice does not double your record', () => {
    const s = snapshot({ games: { played: 12, won: 7, redeemed: 2, lost: 3 } })
    const file = roundTrip(s)
    const once = mergeSnapshot(s, file)
    const twice = mergeSnapshot(once, file)
    expect(twice.games).toEqual(s.games)
  })

  it('leaves this device without retired preferences', () => {
    const merged = mergeSnapshot(snapshot(), roundTrip(snapshot()))
    expect(merged.prefs).toEqual({})
  })

  it('is idempotent: merging the same file twice changes nothing', () => {
    const mine = snapshot({
      stats: { hus: stats({ correctGuesses: 1 }), kat: stats(COLLECTED) },
      journey: { cityIndex: 1, wrapped: { kat: NOW }, arrivedAt: { 1: NOW } },
      games: { played: 4, won: 2, redeemed: 0, lost: 2 },
    })
    const file = roundTrip(
      snapshot({
        stats: { hus: stats(COLLECTED), ost: stats({ correctGuesses: 2 }) },
        journey: { cityIndex: 2, wrapped: { hus: NOW - DAY }, arrivedAt: { 2: NOW } },
        games: { played: 9, won: 5, redeemed: 1, lost: 3 },
      }),
    )
    const once = mergeSnapshot(mine, file)
    const twice = mergeSnapshot(once, file)
    expect(twice).toEqual(once)
  })
})

describe('replace', () => {
  it('makes the device the file without restoring retired preferences', () => {
    const file = roundTrip(
      snapshot({
        stats: { hus: stats({ correctGuesses: 3 }) },
        journey: { cityIndex: 4, wrapped: { hus: NOW }, arrivedAt: {} },
      }),
    )
    const out = replaceSnapshot(file)
    expect(Object.keys(out.stats)).toEqual(['hus'])
    expect(out.journey.cityIndex).toBe(4)
    expect(out.prefs).toEqual({})
  })

  it('drops progress the file does not have — that is the point of it', () => {
    const out = replaceSnapshot(roundTrip(snapshot()))
    expect(out.stats).toEqual({})
    expect(out.journey.cityIndex).toBe(0)
  })
})

describe('summarize', () => {
  it('splits the collection into collected and wrapped', () => {
    const srs: SrsMap = {
      loose: stats(COLLECTED),
      halfway: stats({ greenByGuess: 1 }),
      packed: stats(COLLECTED),
    }
    const file = roundTrip(
      snapshot({
        stats: srs,
        journey: { cityIndex: 1, wrapped: { packed: NOW }, arrivedAt: {} },
      }),
    )
    const sum = summarize(file)
    expect(sum.words).toBe(3)
    expect(sum.collected).toBe(1)
    expect(sum.wrapped).toBe(1)
    expect(sum.cityIndex).toBe(1)
  })

  it('does not double-count a word that is both collected in stats and wrapped', () => {
    const file = roundTrip(
      snapshot({
        stats: { hus: stats(COLLECTED) },
        journey: { cityIndex: 0, wrapped: { hus: NOW }, arrivedAt: {} },
      }),
    )
    const sum = summarize(file)
    expect(sum.collected).toBe(0)
    expect(sum.wrapped).toBe(1)
  })
})

/**
 * A backup carries the language its journey position belongs to.
 *
 * The words are safe to move between languages — every id carries its own —
 * but a city index is a number counting a particular route, and restoring a
 * Danish stop 7 onto a German journey would put the player in a city whose
 * hundred words they have never seen, with the road out of it shut.
 */
describe('backups across languages', () => {
  it('defaults a file written before the seam to Danish', () => {
    // A real pre-seam file: no `language` key at all.
    const file = JSON.parse(JSON.stringify(buildBackup(snapshot(), NOW))) as Record<string, unknown>
    delete file.language
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.backup.language).toBe('da')
  })

  it('round-trips the language it was written with', () => {
    expect(roundTrip(snapshot({ language: 'de' })).language).toBe('de')
  })

  it('merges the words of a foreign file but not its position', () => {
    const here = snapshot({
      language: 'da',
      journey: { cityIndex: 3, wrapped: { 'da:hus': NOW }, arrivedAt: { 3: NOW } },
    })
    const foreign = roundTrip(
      snapshot({
        language: 'de',
        journey: { cityIndex: 7, wrapped: { 'de:Haus': NOW }, arrivedAt: { 7: NOW } },
      }),
    )
    const merged = mergeSnapshot(here, foreign)
    // Both collections, one ledger.
    expect(merged.journey.wrapped).toEqual({ 'da:hus': NOW, 'de:Haus': NOW })
    // The traveller has not moved.
    expect(merged.journey.cityIndex).toBe(3)
    expect(merged.journey.arrivedAt).toEqual({ 3: NOW })
    expect(merged.language).toBe('da')
  })

  it('still merges the position when the languages agree', () => {
    const here = snapshot({
      language: 'da',
      journey: { cityIndex: 3, wrapped: {}, arrivedAt: {} },
    })
    const mine = roundTrip(
      snapshot({ language: 'da', journey: { cityIndex: 7, wrapped: {}, arrivedAt: {} } }),
    )
    expect(mergeSnapshot(here, mine).journey.cityIndex).toBe(7)
  })

  it('merges word records across languages either way', () => {
    const here = snapshot({ language: 'da', stats: { 'da:hus': stats(COLLECTED) } })
    const foreign = roundTrip(snapshot({ language: 'de', stats: { 'de:Haus': stats(COLLECTED) } }))
    const merged = mergeSnapshot(here, foreign)
    expect(Object.keys(merged.stats).sort()).toEqual(['da:hus', 'de:Haus'])
  })
})
