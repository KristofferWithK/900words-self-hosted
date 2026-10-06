import { CITY1_CATALOG } from '../review/city1'
import { testRow } from '../review/city1.fixtures'
import { describe, expect, it, vi } from 'vitest'
import { WORDS } from '../data/words'
import audioLead from '../data/audio-lead.da.json'
import upgradeAudio from '../data/city1-sentence-audio.da.upgrade.runtime.json'
import articlePhrases from '../data/article-phrases.da.json'
import city1Roster from '../data/city1-replacement-corpus.da.json'
import city1LedaLeadMap from '../data/audio-lead.de.city1.json'
import { ACTIVE } from '../lang/active'
import { tutorialScriptFor } from '../onboarding/tutorial'
import { type AudioFailure, type ClipLoad, type WordAudioPorts, ARTICLE_MAX_MS, LEAD_PREROLL_MS, MEMO_MAX, PRELOAD_LANES, articleAudioUrl, articlePhraseAudioUrl, audioSlug, city1LedaPhraseAudioUrl, city1LedaWordAudioUrl, clipStartAt, clipStartAtFromGermanLeadMap, createWordPlayer, exampleAudioUrl, loadBakedClip, spokenArticleOf, survivalAudioUrl, taskAudioUrl, wordAudioUrl, playCity1Sentence, stopWordAudio } from './speak'

/**
 * The filename rule is written twice — once in `speak.ts` for the app, once in
 * `scripts/audio-slug.mjs` for the build script, because a .mjs run by node
 * cannot import TypeScript. Two copies of a rule is a bug waiting for a quiet
 * week, so this compares them over the whole dataset rather than trusting
 * either.
 *
 * The failure mode if they ever drift is not a wrong filename. The script
 * writes `koebe.mp3`, the app asks for `kobe.mp3`, every request 404s, and
 * every word is reported as a recording that did not load. (It used to fall
 * back to the device voice instead, and nothing would have looked broken.)
 */
async function scriptSlug() {
  // Not a literal specifier, so tsc leaves the untyped .mjs alone.
  const href = new URL('../../scripts/audio-slug.mjs', import.meta.url).href
  const mod = (await import(/* @vite-ignore */ href)) as {
    audioSlug: (s: string) => string
    slugForId: (id: string) => string | undefined
  }
  return mod
}

describe('the name a clip is baked under', () => {
  it('folds Danish letters to ASCII rather than percent-encoding them', () => {
    expect(audioSlug('købe')).toBe('koebe')
    expect(audioSlug('æble')).toBe('aeble')
    expect(audioSlug('hånd')).toBe('haand')
  })

  it('routes German City 1 words and article+noun phrases to versioned Leda paths', () => {
    expect(wordAudioUrl('de:Mutter')).toMatch(/\/audio\/de\/city1-leda-v1\/word\/mutter\.mp3$/)
    expect(wordAudioUrl('de:Mutter', 'slow')).toMatch(/\/audio\/de\/city1-leda-v1\/word\/slow\/mutter\.mp3$/)
    expect(city1LedaWordAudioUrl('de:Mutter')).toBe(wordAudioUrl('de:Mutter'))
    expect(city1LedaPhraseAudioUrl('de:Mutter', 'die')).toMatch(/\/audio\/de\/city1-leda-v1\/phrase\/die-mutter\.mp3$/)
    expect(city1LedaPhraseAudioUrl('de:Kind', 'das')).toMatch(/\/audio\/de\/city1-leda-v1\/phrase\/das-kind\.mp3$/)
    expect(city1LedaPhraseAudioUrl('de:Vater', 'der')).toMatch(/\/audio\/de\/city1-leda-v1\/phrase\/der-vater\.mp3$/)
    expect(city1LedaPhraseAudioUrl('de:Mutter', 'die', 'slow')).toMatch(/\/audio\/de\/city1-leda-v1\/phrase\/slow\/die-mutter\.mp3$/)
    expect(city1LedaPhraseAudioUrl('de:Mutter', 'der')).toBeUndefined()
    expect(city1LedaPhraseAudioUrl('de:kommen', 'der')).toBeUndefined()
    expect(articleAudioUrl('de:Mutter', 'die')).toMatch(/\/audio\/de\/article\/die\.mp3$/)
  })

  it('keeps æøå apart from their ASCII bases, which the obvious rule does not', () => {
    // The obvious rule is NFD-then-strip-marks, and it turns å into a, æ into
    // ae's first letter and ø into o. Seven pairs in the dataset differ by
    // exactly that, so the obvious rule hands each pair one file — and the app
    // would play «tage» when asked for «tåge» with nothing looking broken.
    //
    // The list is the whole set, re-derived after the word selection
    // (docs/word-selection.md) took «være» and «bare» out of the nine hundred
    // and brought «får», «tåge» and «bad» in. It is worth re-deriving whenever
    // the dataset changes: a pair that leaves takes a real trap with it.
    const naive = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/æ/g, 'a')
        .replace(/ø/g, 'o')
    const pairs = [
      ['får', 'far'],
      ['tåge', 'tage'],
      ['tænke', 'tanke'],
      ['svær', 'svar'],
      ['båd', 'bad'],
      ['blød', 'blod'],
      ['påstå', 'pasta'],
    ]
    const inDataset = new Set(WORDS.map((w) => w.da))
    for (const [a, b] of pairs) {
      expect(inDataset.has(a), a).toBe(true)
      expect(inDataset.has(b), b).toBe(true)
      expect(naive(a), `${a}/${b} is why the fold happens first`).toBe(naive(b))
      expect(audioSlug(a)).not.toBe(audioSlug(b))
    }
  })

  it('does not care which normalisation the word arrived in', () => {
    // macOS filesystems hand back NFD; the JSON is NFC. Same file either way.
    expect(audioSlug('hår'.normalize('NFD'))).toBe(audioSlug('hår'.normalize('NFC')))
  })

  it('gives all 900 words a distinct, filesystem-safe name', () => {
    const seen = new Map<string, string>()
    for (const w of WORDS) {
      const url = wordAudioUrl(w.id)
      expect(url, w.id).toBeDefined()
      const file = url!.split('/').pop()!
      // The underscore is here for one word and one operating system: «nul» is
      // the Danish for zero and NUL is a Windows device, extension included.
      expect(file, w.id).toMatch(/^[a-z0-9-]+_?\.mp3$/)
      expect(seen.has(file), `${w.id} and ${seen.get(file)} both want ${file}`).toBe(false)
      seen.set(file, w.id)
    }
    expect(seen.size).toBe(WORDS.length)
  })

  /**
   * Found by git refusing to add the file, which is a late and confusing place
   * to find it. Windows reserves CON, PRN, AUX, NUL and the numbered COM/LPT
   * ports as device names, and the reservation ignores the extension — so
   * `nul.mp3` IS the null device. Baking Danish on Windows therefore opened
   * that device, wrote the clip into it, and reported success: the word had no
   * audio, and nothing said so.
   *
   * «nul» is the only one of the 900, but the rule is cheap and German or any
   * later language may bring another.
   */
  it('escapes the names Windows keeps for its own devices', () => {
    for (const reserved of ['nul', 'con', 'prn', 'aux', 'com1', 'lpt9']) {
      expect(audioSlug(reserved, (s) => s), reserved).toBe(`${reserved}_`)
    }
  })

  it('leaves a word that merely contains one alone', () => {
    // «nullpunkt» is an ordinary filename; only the whole name is reserved.
    expect(audioSlug('nullpunkt', (s) => s)).toBe('nullpunkt')
    expect(audioSlug('contact', (s) => s)).toBe('contact')
  })

  it('agrees with the copy the build script bakes with, word for word', async () => {
    const script = await scriptSlug()
    for (const w of WORDS) {
      const mine = wordAudioUrl(w.id)!.split('/').pop()!.replace('.mp3', '')
      expect(script.slugForId(w.id), w.id).toBe(mine)
    }
  })

  it('reads the language out of the id, so a second language needs no new path', () => {
    expect(wordAudioUrl('da:hus')).toMatch(/audio\/da\/hus\.mp3$/)
    expect(wordAudioUrl('de:Haus')).toMatch(/audio\/de\/city1-leda-v1\/word\/haus\.mp3$/)
  })

  it('has no url for something that is not a word id', () => {
    expect(wordAudioUrl('hus')).toBeUndefined()
    expect(wordAudioUrl('da:')).toBeUndefined()
    expect(wordAudioUrl('da:???')).toBeUndefined()
  })

  it('keeps accepted task-audio ids in their own on-demand directory', () => {
    expect(taskAudioUrl('sonderborg-situation-1-audio-1')).toMatch(
      /audio\/da\/task\/sonderborg-situation-1-audio-1\.mp3\?v=[a-f0-9]{16}$/,
    )
    expect(taskAudioUrl('../a')).toBeUndefined()
    expect(taskAudioUrl('not-an-accepted-line')).toBeUndefined()
    expect(taskAudioUrl('sonderborg-situation-1-audio-1', 'Danish')).toBeUndefined()
  })

  it('keeps authored Survival turns in a separate versioned directory', () => {
    expect(survivalAudioUrl('sonderborg-situation-1-line-1')).toMatch(
      /audio\/da\/survival\/sonderborg-situation-1-line-1\.mp3\?v=[a-f0-9]{16}$/,
    )
    expect(survivalAudioUrl('../a')).toBeUndefined()
    expect(survivalAudioUrl('not-an-authored-turn')).toBeUndefined()
    expect(survivalAudioUrl('sonderborg-situation-1-line-1', 'en')).toBeUndefined()
  })

  it('versions one Danish example clip by its frozen source hash', () => {
    expect(exampleAudioUrl('da:job')).toMatch(/audio\/da\/example\/job\.mp3\?v=[a-f0-9]{16}$/)
    expect(exampleAudioUrl('da:købe')).toContain('/example/')
    expect(exampleAudioUrl('da:hus')).toContain('/example/')
    expect(exampleAudioUrl('da:hus', 'en')).toBeUndefined()
    expect(exampleAudioUrl('not-a-word')).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ */

const CLIP = new Blob([new Uint8Array([1, 2, 3])])

/** A player with every side effect counted. */
function harness(over: Partial<WordAudioPorts> = {}) {
  const calls = {
    load: [] as string[],
    played: 0,
    playOptions: [] as Array<{ key?: string; url?: string; playbackRate?: number; preservesPitch?: boolean } | undefined>,
    /** Every clip readied ahead of a tap, by key. */
    warmed: [] as string[],
    /** Every recording that was expected and did not play. */
    failures: [] as AudioFailure[],
    stopped: 0,
    primed: 0,
    /** What happened, in order — the only way to ask "before the await?". */
    order: [] as string[],
  }
  let answer: ClipLoad = { kind: 'clip', clip: CLIP }
  let playFails: Error | null = null

  const ports: WordAudioPorts = {
    async load(url) {
      calls.load.push(url)
      calls.order.push('load')
      return answer
    },
    async play(_clip, options) {
      calls.played++
      calls.playOptions.push(options)
      calls.order.push('play')
      if (playFails) throw playFails
      // A clip on this port is over the moment it starts; the article path
      // waits on this, and a port that forgets it costs a wait, not the word.
      options.onEnded?.()
    },
    warm: (key) => void (calls.warmed.push(key), calls.order.push('warm')),
    stop: () => void (calls.stopped++, calls.order.push('stop')),
    prime: () => void (calls.primed++, calls.order.push('prime')),
    wanted: () => true,
    report: (failure) => void (calls.failures.push(failure), calls.order.push('report')),
    ...over,
  }
  return {
    calls,
    player: createWordPlayer(ports),
    answers(next: ClipLoad) {
      answer = next
    },
    playThrows(e: Error | null) {
      playFails = e
    },
  }
}

describe('starting where the voice starts', () => {
  const lead = (key: string) => (audioLead.entries as Record<string, number>)[key]!

  it('starts a word 60 ms before its measured onset, never before the file', () => {
    const startOf = (key: string) => Math.max(0, lead(key) - LEAD_PREROLL_MS) / 1000
    expect(clipStartAt(wordAudioUrl('da:hus'))).toBeCloseTo(startOf('hus.mp3'), 5)
    expect(clipStartAt(wordAudioUrl('da:hus', 'slow'))).toBeCloseTo(startOf('slow/hus.mp3'), 5)
    // A clip the cut left less than the pre-roll in front of starts at 0, not before the file.
    const shortest = Object.entries(audioLead.entries as Record<string, number>).find(([, ms]) => ms < LEAD_PREROLL_MS)
    expect(shortest).toBeDefined()
    expect(clipStartAt(`./audio/da/${shortest![0]}`)).toBe(0)
  })

  // The sixteen replacements of 2026-09-26 (scripts/data/word-audio-
  // replacements.da.json) were frame-trimmed before install. Trimming AND the
  // onset seek must not add up to a double skip: every one still starts with
  // the full pre-roll ahead of its measured voice, never inside it.
  const REPLACEMENTS: Array<[string, 'normal' | 'slow']> = [
    ['da:bo', 'normal'], ['da:ben', 'normal'], ['da:bred', 'normal'], ['da:gide', 'normal'], ['da:klar', 'normal'],
    ['da:nå', 'normal'], ['da:ø', 'normal'], ['da:ond', 'normal'], ['da:pude', 'normal'], ['da:ske', 'normal'],
    ['da:bro', 'slow'], ['da:få', 'slow'], ['da:idé', 'slow'], ['da:klar', 'slow'], ['da:ø', 'slow'], ['da:ord', 'slow'],
  ]
  it.each(REPLACEMENTS)('starts replaced %s (%s) with its whole pre-roll ahead of the voice', (id, variant) => {
    const url = wordAudioUrl(id, variant)!
    const key = /audio\/da\/(.+\.mp3)/.exec(url)![1]!
    const voiceMs = lead(key)
    expect(voiceMs).toBeGreaterThanOrEqual(20)
    expect(voiceMs).toBeLessThanOrEqual(150)
    expect(voiceMs - clipStartAt(url) * 1000).toBeCloseTo(Math.min(voiceMs, LEAD_PREROLL_MS), 5)
  })

  it('measures the accepted slow ord cut: 65 ms before its voice, started 5 ms in', () => {
    expect(lead('slow/ord.mp3')).toBe(65)
    expect(clipStartAt(wordAudioUrl('da:ord', 'slow'))).toBeCloseTo(0.005, 5)
  })

  it('reads the example past its version query', () => {
    expect(clipStartAt(exampleAudioUrl('da:job'))).toBeCloseTo(Math.max(0, lead('example/job.mp3') - LEAD_PREROLL_MS) / 1000, 5)
  })

  it('consumes only source-pinned German lead entries and starts before measured onset', () => {
    const key = 'city1-leda-v1/phrase/slow/das-maedchen.mp3'
    const digest = city1LedaLeadMap.manifestSha256
    const complete = {
      status: 'complete',
      version: 'city1-leda-v1',
      manifestSha256: digest,
      prerollMs: 60,
      entries: { [key]: { leadMs: 420, sha256: 'a'.repeat(64) } },
    }
    expect(clipStartAtFromGermanLeadMap(key, complete, digest)).toBeCloseTo(0.36, 5)
    expect(clipStartAtFromGermanLeadMap(key, complete, 'b'.repeat(64))).toBe(0)
    expect(clipStartAtFromGermanLeadMap(key, { ...complete, status: 'awaiting-audio' }, digest)).toBe(0)

    const normalKey = 'city1-leda-v1/word/mutter.mp3'
    const slowKey = 'city1-leda-v1/word/slow/mutter.mp3'
    const entries = city1LedaLeadMap.entries as Record<string, { leadMs: number; sha256: string }>
    const normalUrl = city1LedaWordAudioUrl('de:Mutter')
    const slowUrl = city1LedaWordAudioUrl('de:Mutter', 'slow')
    expect(city1LedaLeadMap.version).toBe('city1-leda-v1')
    expect(digest).toBe('6a13c0a1e6fe6df3a3c1d790f8d880360ff3c270657fa173e6f42e9545b89487')

    if (city1LedaLeadMap.status === 'awaiting-audio') {
      expect(Object.keys(entries)).toHaveLength(0)
      expect(clipStartAt(normalUrl)).toBe(0)
      expect(clipStartAt(slowUrl)).toBe(0)
    } else if (city1LedaLeadMap.status === 'complete') {
      expect(city1LedaLeadMap.prerollMs).toBe(LEAD_PREROLL_MS)
      expect(entries[normalKey]).toMatchObject({
        leadMs: 475,
        sha256: 'd538e96ed8efb52ee30655cfe490c34a68cc1840066d023b2ea946f39791abc1',
      })
      expect(entries[slowKey]).toMatchObject({
        leadMs: 470,
        sha256: 'ca51810e5c81d0aff557e7ed1578fa0b9d0b639d39c6f07a05498f1ff588c317',
      })
      expect(clipStartAt(normalUrl)).toBeCloseTo((475 - LEAD_PREROLL_MS) / 1000, 5)
      expect(clipStartAt(slowUrl)).toBeCloseTo((470 - LEAD_PREROLL_MS) / 1000, 5)
      expect(clipStartAt(normalUrl?.replace(/mutter\.mp3$/, 'muter.mp3'))).toBe(0)
    } else {
      expect.fail(`unexpected German lead-map status: ${city1LedaLeadMap.status}`)
    }
  })

  /**
   * The two bake families are measured together and asserted APART.
   *
   * The word bakes are cut in place after the fact by
   * scripts/trim-audio-silence.mjs; the City 1 sentences are cut inside their
   * own importer, which keeps the original whole whenever the cut will not
   * verify sample-for-sample (45 of 704 did). Their distributions are
   * genuinely different — median 70 ms against 135 — so pooling them does not
   * loosen one assertion, it retires both: a word bake that padded again
   * would hide under the sentences' tail, and a sentence re-import that
   * skipped trimming entirely would hide under the words' bulk. Measured
   * 2026-09-11 over 3,694 clips.
   */
  // The focus upgrade's 58 clips (2026-09-26) are measured, never trimmed,
  // so they are their own family rather than part of the Aoede import's band.
  const upgradeKeys = new Set(upgradeAudio.recordings.map((r) => r.url.replace('/audio/da/', '')))
  const leadsIn = (family: 'words' | 'city1' | 'upgrade') =>
    Object.entries(audioLead.entries as Record<string, number>)
      .filter(([k]) => family === 'upgrade' ? upgradeKeys.has(k)
        : !upgradeKeys.has(k) && k.startsWith('city1/') === (family === 'city1'))
      .map(([, ms]) => ms)
      .sort((a, b) => a - b)

  it('finds the silence CUT off the front of the bake, not merely skipped', () => {
    // «amerikansk» carried 720 ms of silence before the voice; the cut
    // (scripts/trim-audio-silence.mjs) left it 75. If this climbs back, a
    // bake has put the padding back and the trim needs re-running.
    expect(lead('amerikansk.mp3')).toBeLessThanOrEqual(120)
    // 2,990 word, slow, example, survival, task and article clips: median 70,
    // p90 105. Unchanged bands, now scoped to the family they were measured on.
    const leads = leadsIn('words')
    expect(leads[Math.floor(leads.length / 2)]).toBeLessThanOrEqual(100)
    expect(leads[Math.floor(leads.length * 0.9)]).toBeLessThanOrEqual(150)
    // Three scoped clips remain above 150 ms because no verified cut fit the
    // 60–80 ms lead window. Playback still parks them at their measured onset.
    expect(leads.filter((ms) => ms > 150)).toEqual([265, 600, 820])
  })

  it('keeps the release-scoped whole-frame trims at a measured 60–80 ms', () => {
    const trimmed = [
      'example/alene.mp3',
      'example/behandle.mp3',
      'example/bord.mp3',
      'example/mene.mp3',
      'example/regering.mp3',
      'laane.mp3',
      'laekker.mp3',
      'land.mp3',
      'lave.mp3',
      'moerk.mp3',
      'survival/ribe-situation-3-line-2.mp3',
      'task/aarhus-situation-4-audio-1.mp3',
      'task/odense-situation-4-audio-1.mp3',
    ]
    for (const key of trimmed) {
      expect(lead(key)).toBeGreaterThanOrEqual(60)
      expect(lead(key)).toBeLessThanOrEqual(80)
    }
    expect(lead('example/tjene.mp3')).toBe(265)
    expect(lead('rejse.mp3')).toBe(820)
    expect(lead('slow/knae.mp3')).toBe(600)
  })

  it('keeps the City 1 sentence bake in its own band, the 45 unverified cuts included', () => {
    // The importer's own trim (scripts/aoede-bake/core.mjs, `derivative`)
    // keeps 120 ms of lead by design and refuses a cut it cannot verify
    // against the original's samples. Measured after the import: 704 clips,
    // median 135, p90 145; the 659 it did cut run to 645 max, and the 45 it
    // did not carry up to 985. Those 45 are exactly what LEAD_PREROLL_MS and
    // this data exist for — the player starts each at its own onset.
    const leads = leadsIn('city1')
    expect(leads).toHaveLength(704)
    expect(leads[Math.floor(leads.length / 2)]).toBeLessThanOrEqual(150)
    expect(leads[Math.floor(leads.length * 0.9)]).toBeLessThanOrEqual(175)
    // 49 today: the 45 untrimmed plus four whose verified cut still left more
    // than 150 ms. A re-import that skipped trimming would put all 704 here.
    expect(leads.filter((ms) => ms > 150).length).toBeLessThanOrEqual(60)
  })

  it('has a measurement for every City 1 sentence recording, keyed the way the player looks it up', () => {
    // The key is whatever `clipStartAt` pulls out of the URL: everything
    // after `audio/<lang>/`. That is why the delivered path had to become
    // ASCII (`.../board/koebe/v1/normal.mp3`) — a percent-escaped colon in
    // the URL and a decoded one on disk cannot both be this key.
    expect(CITY1_CATALOG.recordings).toHaveLength(704 + 58)
    expect(leadsIn('upgrade')).toHaveLength(58)
    const missing: string[] = []
    for (const r of CITY1_CATALOG.recordings) {
      const key = r.url.replace('/audio/da/', '')
      if (typeof lead(key) !== 'number') missing.push(key)
    }
    expect(missing).toEqual([])
    // End to end through the player's own resolver, base path and all.
    const first = CITY1_CATALOG.recordings[0]!
    expect(clipStartAt(`${import.meta.env.BASE_URL}${first.url.slice(1)}`))
      .toBeCloseTo(Math.max(0, lead(first.url.replace('/audio/da/', '')) - LEAD_PREROLL_MS) / 1000, 5)
  })

  it('starts at 0 for a clip it has no measurement of', () => {
    expect(clipStartAt(undefined)).toBe(0)
    expect(clipStartAt('./audio/da/chapter/chapter-01.mp3?v=abc')).toBe(0)
    expect(clipStartAt('./audio/de/haus.mp3')).toBe(0)
  })

  it('has a measurement for every word, its slow twin and its example', () => {
    const missing: string[] = []
    for (const w of WORDS) {
      const slug = audioSlug(w.da)
      for (const key of [`${slug}.mp3`, `slow/${slug}.mp3`, `example/${slug}.mp3`]) {
        if (typeof lead(key) !== 'number') missing.push(key)
      }
    }
    expect(missing).toEqual([])
  })
})

describe('readying clips ahead of the tap', () => {
  it('loads each word of a board once and warms it, so the tap only has to start it', async () => {
    const h = harness()
    await h.player.preloadWords(['da:hus', 'da:kat'])
    expect(h.calls.load).toEqual([wordAudioUrl('da:hus'), wordAudioUrl('da:kat')])
    expect(h.calls.warmed).toEqual(['normal:da:hus', 'normal:da:kat'])
    // The tap: no load, no wait — straight to play.
    await expect(h.player.playWord('da:hus')).resolves.toBe('baked')
    expect(h.calls.load).toHaveLength(2)
    expect(h.calls.order.slice(-3)).toEqual(['stop', 'prime', 'play'])
    expect(h.calls.playOptions.at(-1)).toMatchObject({ key: 'normal:da:hus' })
  })

  it('readies the slow twin and the example under their own keys', async () => {
    const h = harness()
    await h.player.preloadWords(['da:job'], { slow: true })
    await h.player.preloadExamples(['da:job'])
    expect(h.calls.warmed).toEqual(['slow:da:job', 'example:da:job'])
    expect(h.calls.load).toEqual([wordAudioUrl('da:job', 'slow'), exampleAudioUrl('da:job')])
  })

  it('is quiet about a clip the build has not got, until that clip is tapped', async () => {
    const h = harness()
    h.answers({ kind: 'absent' })
    await h.player.preloadWords(['da:hus'])
    expect(h.calls.warmed).toEqual([])
    expect(h.calls.failures).toEqual([])
    // Remembered as absent: the tap does not ask again, and DOES say so.
    await expect(h.player.playWord('da:hus')).resolves.toBe('failed')
    expect(h.calls.load).toHaveLength(1)
    expect(h.calls.failures).toEqual([{ kind: 'word', reason: 'absent' }])
  })

  it('does not load again what a tap already fetched', async () => {
    const h = harness()
    await h.player.playWord('da:hus')
    await h.player.preloadWords(['da:hus', 'da:kat'])
    expect(h.calls.load).toEqual([wordAudioUrl('da:hus'), wordAudioUrl('da:kat')])
  })

  it('loads a board a few at a time, in dealt order, never all at once', async () => {
    // Each load is held open until released, so the number in flight can be
    // counted. One at a time left the last card cold for seconds; all
    // eighteen at once is slower through the shell's file handler.
    const pending: Array<() => void> = []
    let inFlight = 0
    let mostInFlight = 0
    const h = harness({
      load: (url) =>
        new Promise((resolve) => {
          inFlight++
          mostInFlight = Math.max(mostInFlight, inFlight)
          h.calls.load.push(url)
          pending.push(() => {
            inFlight--
            resolve({ kind: 'clip', clip: CLIP })
          })
        }),
    })
    const board = ['da:hus', 'da:kat', 'da:mor', 'da:far', 'da:bil', 'da:bog', 'da:dør', 'da:ost']
    const done = h.player.preloadWords(board)
    await Promise.resolve()
    expect(h.calls.load).toHaveLength(PRELOAD_LANES)
    expect(h.calls.load).toEqual(board.slice(0, PRELOAD_LANES).map((id) => wordAudioUrl(id)))
    while (pending.length) {
      pending.shift()!()
      await new Promise((r) => setTimeout(r, 0))
    }
    await done
    expect(mostInFlight).toBe(PRELOAD_LANES)
    expect(h.calls.load).toEqual(board.map((id) => wordAudioUrl(id)))
    expect(h.calls.warmed).toEqual(board.map((id) => `normal:${id}`))
  })
})

describe('playWord', () => {
  it('plays the baked clip and reports nothing', async () => {
    const h = harness()
    await expect(h.player.playWord('da:hus')).resolves.toBe('baked')
    expect(h.calls.load).toEqual([wordAudioUrl('da:hus')])
    expect(h.calls.played).toBe(1)
    expect(h.calls.failures).toEqual([])
  })

  /**
   * The rule this whole file now turns on: a recording the app expects and
   * cannot play is REPORTED, and nothing else is played in its place. There
   * used to be a second voice here — the device's — and it hid every failure
   * the loader ever had (speak.ts says how much that cost).
   */
  it('plays nothing and says so when the build has no clip', async () => {
    const h = harness()
    h.answers({ kind: 'absent' })
    await expect(h.player.playWord('da:hus')).resolves.toBe('failed')
    expect(h.calls.played).toBe(0)
    expect(h.calls.failures).toEqual([{ kind: 'word', reason: 'absent' }])
  })

  it('asks once for a clip that is not there, and says so every time it is tapped', async () => {
    const h = harness()
    h.answers({ kind: 'absent' })
    await h.player.playWord('da:hus')
    await h.player.playWord('da:hus')
    await h.player.playWord('da:hus')
    expect(h.calls.load).toHaveLength(1)
    expect(h.calls.failures).toHaveLength(3)
  })

  it('but keeps asking when the answer was only that it could not be reached', async () => {
    // Offline is not the same as absent. Remembering it would cost the player
    // baked audio for the rest of the session over one dropped connection.
    const h = harness()
    h.answers({ kind: 'unreachable' })
    await h.player.playWord('da:hus')
    await h.player.playWord('da:hus')
    expect(h.calls.load).toHaveLength(2)
    expect(h.calls.failures).toEqual([
      { kind: 'word', reason: 'unreachable' },
      { kind: 'word', reason: 'unreachable' },
    ])
  })

  it('fetches a clip once and plays it from memory after that', async () => {
    const h = harness()
    await h.player.playWord('da:hus')
    await h.player.playWord('da:hus')
    expect(h.calls.load).toHaveLength(1)
    expect(h.calls.played).toBe(2)
  })

  it('keeps a clip that keeps being played, however many others come after it', async () => {
    // The memo drops the clip unheard longest, not the one dealt first. Under
    // first-in-first-out, a board's own clips fell out after a few lookups
    // and the next tap fetched before it played.
    const h = harness()
    await h.player.playWord('da:hus')
    const husLoads = [...h.calls.load]
    const others = WORDS.map(w => w.id).filter(id => id !== 'da:hus').slice(0, MEMO_MAX * 2)
    for (const id of others) {
      await h.player.playWord(id)
      await h.player.playWord('da:hus')
    }
    for (const url of husLoads) expect(h.calls.load.filter(u => u === url)).toHaveLength(1)
  })

  it('reports a refusal to play as a failure of its own', async () => {
    // iOS autoplay policy, or bytes that will not decode.
    const h = harness()
    h.playThrows(new DOMException('blocked', 'NotAllowedError'))
    await expect(h.player.playWord('da:hus')).resolves.toBe('failed')
    expect(h.calls.played).toBe(1)
    expect(h.calls.failures).toEqual([{ kind: 'word', reason: 'play' }])
  })

  it('and keeps the clip, because the next tap may be allowed', async () => {
    const h = harness()
    h.playThrows(new DOMException('blocked', 'NotAllowedError'))
    await h.player.playWord('da:hus')
    h.playThrows(null)
    await expect(h.player.playWord('da:hus')).resolves.toBe('baked')
    expect(h.calls.load).toHaveLength(1)
    expect(h.calls.failures).toHaveLength(1)
  })

  it('unlocks the element inside the tap, before anything is awaited', async () => {
    const h = harness()
    const going = h.player.playWord('da:hus')
    // Read before awaiting, so what is asserted is what ran synchronously —
    // which on iOS is the whole of the gesture the element can be unlocked in.
    // If `prime` ever moves below the fetch, the gesture is over by the time it
    // runs and the first word of every session falls back to speech.
    expect(h.calls.order).toEqual(['stop', 'prime', 'load'])
    await going
    expect(h.calls.order).toEqual(['stop', 'prime', 'load', 'play'])
  })

  it('silences the previous word before starting the next', async () => {
    const h = harness()
    await h.player.playWord('da:hus')
    await h.player.playWord('da:kat')
    expect(h.calls.stopped).toBe(2)
  })

  it('lets the newest tap win when three arrive together', async () => {
    // Every one of them is mid-fetch when the next arrives. Only the last may
    // reach the speaker; the ones cut off are not failures and must not be
    // reported as such — a newer tap overtaking an older one is the design.
    let release: (() => void) | undefined
    const gate = new Promise<void>((r) => (release = r))
    const h = harness({
      async load() {
        await gate
        return { kind: 'absent' }
      },
    })
    const all = [
      h.player.playWord('da:hus'),
      h.player.playWord('da:kat'),
      h.player.playWord('da:hund'),
    ]
    release!()
    await Promise.all(all)
    expect(h.calls.failures).toEqual([{ kind: 'word', reason: 'absent' }])
  })

  it('and does not let an overtaken clip play on top of the one that won', async () => {
    // The same race with clips rather than fallbacks, which is the version that
    // is actually audible: three fetches land at once and, without the check
    // after the await, all three reach the speaker — the player taps «hund» and
    // hears «hus» over it.
    let release: (() => void) | undefined
    const gate = new Promise<void>((r) => (release = r))
    const h = harness({
      async load() {
        await gate
        return { kind: 'clip', clip: CLIP }
      },
    })
    const all = [
      h.player.playWord('da:hus'),
      h.player.playWord('da:kat'),
      h.player.playWord('da:hund'),
    ]
    release!()
    await Promise.all(all)
    expect(h.calls.played).toBe(1)
  })

  it('says nothing at all when the player has turned sound off', async () => {
    const h = harness({ wanted: () => false })
    await expect(h.player.playWord('da:hus')).resolves.toBe('silent')
    expect(h.calls.load).toEqual([])
    expect(h.calls.played).toBe(0)
    expect(h.calls.failures).toEqual([])
    expect(h.calls.primed).toBe(0)
  })

  it('and stops what is already playing when it is turned off mid-clip', async () => {
    const h = harness({ wanted: () => false })
    await h.player.playWord('da:hus')
    expect(h.calls.stopped).toBe(1)
  })

  it('has nothing to play and nothing to report for something that is not a word', async () => {
    // TranslateBox used to hold a word Casey translated from outside the 900
    // and speak it in the device voice. There is no recording to expect for
    // it, so there is no failure either: it simply has no speaker.
    const h = harness()
    await expect(h.player.playWord('not-an-id')).resolves.toBe('silent')
    expect(h.calls.load).toEqual([])
    expect(h.calls.failures).toEqual([])
    expect(h.calls.primed).toBe(0)
  })

  it('never rejects, whatever the device does', async () => {
    const h = harness({ load: () => Promise.reject(new Error('boom')) })
    // A rejection here would be an unhandled promise on an ordinary tap: every
    // call site is an onClick, and none of them can await.
    await expect(h.player.playWord('da:hus')).resolves.toBe('failed')
    // And a thrown load is treated as unreachable, and reported as such.
    expect(h.calls.failures).toEqual([{ kind: 'word', reason: 'unreachable' }])
  })

  it('reports even a port that throws, so the notice still appears', async () => {
    const h = harness({ prime: () => { throw new Error('no element') } })
    await expect(h.player.playWord('da:hus')).resolves.toBe('failed')
    expect(h.calls.failures).toEqual([{ kind: 'word', reason: 'play' }])
  })
})

describe('a City 1 noun said as one performance with its article', () => {
  const phrases = (articlePhrases as { words: Array<{ id: string; article: string; da: string }> }).words
  const roster = new Set((city1Roster as { wordIds: string[] }).wordIds)

  it('lists exactly the City 1 nouns the card prints an article for, then the other practice-board nouns, with that article', () => {
    const city1 = WORDS.filter((w) => roster.has(w.id) && spokenArticleOf(w.id))
    const practice = tutorialScriptFor('da').wordIds
      .filter((id) => !roster.has(id) && spokenArticleOf(id))
      .map((id) => WORDS.find((w) => w.id === id)!)
    const expected = [...city1, ...practice].map((w) => `${spokenArticleOf(w.id)} ${w.da}`)
    expect(phrases.map((row) => `${row.article} ${row.da}`)).toEqual(expected)
    expect(city1).toHaveLength(48)
    expect(practice.map((w) => w.id)).toEqual(['da:æble', 'da:kaffe', 'da:bord', 'da:ost'])
  })

  it('has a measured, promptly starting recording at both speeds for every listed noun', () => {
    for (const row of phrases) {
      for (const variant of ['normal', 'slow'] as const) {
        const url = articlePhraseAudioUrl(row.id, variant)!
        const key = /audio\/da\/(.+\.mp3)$/.exec(url)![1]!
        expect(key).toBe(`phrase/${variant === 'slow' ? 'slow/' : ''}${audioSlug(`${row.article} ${row.da}`)}.mp3`)
        const lead = (audioLead.entries as Record<string, number>)[key]
        expect(lead, key).toBeGreaterThanOrEqual(20)
        expect(lead, key).toBeLessThanOrEqual(150)
      }
    }
    expect(articlePhraseAudioUrl('da:bog')).toBeUndefined()
    expect(articlePhraseAudioUrl('de:Mutter')).toBeUndefined()
  })

  it('plays the one phrase clip for a listed noun, no article clip, at either speed', async () => {
    const h = harness({ article: spokenArticleOf })
    await expect(h.player.playWord('da:hus')).resolves.toBe('baked')
    await expect(h.player.playWord('da:hus', { slow: true })).resolves.toBe('baked')
    expect(h.calls.load).toEqual([articlePhraseAudioUrl('da:hus'), articlePhraseAudioUrl('da:hus', 'slow')])
    expect(h.calls.load.some((url) => url.includes('/article/'))).toBe(false)
    expect(h.calls.playOptions.map((o) => o?.key)).toEqual(['da-phrase:normal:da:hus', 'da-phrase:slow:da:hus'])
  })

  it('still says a listed noun bare when the caller asks for no article', async () => {
    const h = harness({ article: spokenArticleOf })
    await h.player.playWord('da:hus', { article: false })
    expect(h.calls.load).toEqual([wordAudioUrl('da:hus')])
  })

  it('warms the phrase a board tap will ask for, so the tap loads nothing', async () => {
    const h = harness({ article: spokenArticleOf })
    await h.player.preloadWords(['da:hus', 'da:bog'])
    expect(h.calls.warmed).toContain('da-phrase:normal:da:hus')
    expect(h.calls.warmed).not.toContain('article:da:et')
    const loads = h.calls.load.length
    await h.player.playWord('da:hus')
    expect(h.calls.load).toHaveLength(loads)
  })

  it('ranks a board request so a screen pool smaller than it keeps what the taps ask for: articles and phrases first, the bare words of phrase nouns last', async () => {
    const warmed: Array<{ key: string; owner?: unknown; rank: number }> = []
    let owner: unknown = 'cafe'
    const h = harness({
      article: spokenArticleOf,
      owner: () => owner,
      warm: (key, _url, _clip, ready) => void warmed.push({ key, ...ready! }),
    })
    const pending = h.player.preloadWords(['da:hus', 'da:bog', 'da:købe'])
    // The pool is the one asked from, even when the screen changes before the bytes arrive.
    owner = 'home'
    await pending
    expect(warmed.every((w) => w.owner === 'cafe')).toBe(true)
    const rank = (key: string) => warmed.find((w) => w.key === key)!.rank
    expect(rank('da-phrase:normal:da:hus')).toBeLessThan(rank('normal:da:købe'))
    expect(rank('normal:da:købe')).toBeLessThan(rank('normal:da:hus'))
    // «bog» has no phrase: its article clip and its word are what its tap plays, both ahead of «hus»'s bare word.
    expect(rank('article:da:en')).toBe(0)
    expect(rank('normal:da:bog')).toBeLessThan(rank('normal:da:hus'))
  })
})

/* ------------------------------------------------------------------ *
 * The article in front of the word
 * ------------------------------------------------------------------ */

describe('the article a tapped noun is said with', () => {
  // Nouns outside City 1's one-performance phrase list (article-phrases.da.json),
  // which still chain the article clip and the word: «bog» common, «kage»
  // common here as the harness's own map says, «købe» a verb.
  const article = (id: string) => ({ 'da:bog': 'et', 'da:kage': 'en' })[id]
  const withArticles = (over: Partial<WordAudioPorts> = {}) => harness({ article, ...over })

  it('says the article and then the word, on one tap', async () => {
    const h = withArticles()
    await expect(h.player.playWord('da:bog')).resolves.toBe('baked')
    expect(h.calls.load).toEqual([articleAudioUrl('da:bog', 'et'), wordAudioUrl('da:bog')])
    expect(h.calls.playOptions.map((o) => o?.key)).toEqual(['article:da:et', 'normal:da:bog'])
    // One tap: the element is unlocked once and the word is not re-primed
    // behind a second stop of its own article.
    expect(h.calls.order).toEqual(['stop', 'prime', 'load', 'play', 'stop', 'prime', 'load', 'play'])
  })

  it('says a word that prints no article bare', async () => {
    const h = withArticles()
    await expect(h.player.playWord('da:købe')).resolves.toBe('baked')
    expect(h.calls.load).toEqual([wordAudioUrl('da:købe')])
    expect(h.calls.played).toBe(1)
  })

  it('and bare on request, with the same word clip', async () => {
    const h = withArticles()
    await h.player.playWord('da:bog', { article: false })
    expect(h.calls.load).toEqual([wordAudioUrl('da:bog')])
  })

  it('is quiet about an article the build has not got, and still says the word', async () => {
    // Before the article bake, or on a phone whose installed build predates
    // it: the word is what was asked for and plays as it always did. Nothing
    // is reported — the notice is for a recording the player expected.
    const h = withArticles({
      async load(url) {
        h.calls.load.push(url)
        return url.includes('/article/') ? { kind: 'absent' } : { kind: 'clip', clip: CLIP }
      },
    })
    await expect(h.player.playWord('da:bog')).resolves.toBe('baked')
    expect(h.calls.playOptions.map((o) => o?.key)).toEqual(['normal:da:bog'])
    expect(h.calls.failures).toEqual([])
    // Remembered as absent: the next noun does not ask for it again.
    await h.player.playWord('da:bog')
    expect(h.calls.load.filter((u) => u.includes('/article/'))).toHaveLength(1)
  })

  it('and about an article that will not play', async () => {
    const h = withArticles({
      async play(_clip, options) {
        h.calls.played++
        h.calls.playOptions.push(options)
        if (options.key.startsWith('article:')) throw new DOMException('blocked', 'NotAllowedError')
        options.onEnded?.()
      },
    })
    await expect(h.player.playWord('da:bog')).resolves.toBe('baked')
    expect(h.calls.failures).toEqual([])
    expect(h.calls.playOptions.map((o) => o?.key)).toEqual(['article:da:et', 'normal:da:bog'])
  })

  it('waits for the article to end before the word, or for the guard to expire', async () => {
    // A port that never says the article ended: the word still follows,
    // after ARTICLE_MAX_MS. An end that never comes must not hold the word.
    const h = withArticles({
      async play(_clip, options) {
        h.calls.played++
        h.calls.playOptions.push(options)
        if (!options.key.startsWith('article:')) options.onEnded?.()
      },
    })
    const started = Date.now()
    await expect(h.player.playWord('da:bog')).resolves.toBe('baked')
    expect(Date.now() - started).toBeGreaterThanOrEqual(ARTICLE_MAX_MS - 50)
    expect(h.calls.played).toBe(2)
  })

  it('lets a newer tap during the article silence both halves', async () => {
    // Every clip is held mid-fetch, so both taps are in flight at once. The
    // first tap's article comes back to find itself overtaken, and its word
    // is never asked for; the second tap says its article and its word.
    let release: (() => void) | undefined
    const gate = new Promise<void>((r) => (release = r))
    const h = withArticles({
      async load(url) {
        h.calls.load.push(url)
        await gate
        return { kind: 'clip', clip: CLIP }
      },
    })
    const first = h.player.playWord('da:bog')
    const second = h.player.playWord('da:kage')
    release!()
    await expect(first).resolves.toBe('silent')
    await expect(second).resolves.toBe('baked')
    expect(h.calls.playOptions.map((o) => o?.key)).toEqual(['article:da:en', 'normal:da:kage'])
    expect(h.calls.failures).toEqual([])
  })

  it('readies the board\'s articles first, once each, ahead of its words', async () => {
    const h = withArticles()
    await h.player.preloadWords(['da:bog', 'da:kage', 'da:købe', 'da:hund'].filter((id) => id !== 'da:hund'))
    expect(h.calls.warmed).toEqual(['article:da:et', 'article:da:en', 'normal:da:bog', 'normal:da:kage', 'normal:da:købe'])
    // The tap on a readied noun loads nothing.
    const loads = h.calls.load.length
    await h.player.playWord('da:bog')
    expect(h.calls.load).toHaveLength(loads)
  })

  it('says nothing at all, article included, with sound off', async () => {
    const h = withArticles({ wanted: () => false })
    await expect(h.player.playWord('da:bog')).resolves.toBe('silent')
    expect(h.calls.load).toEqual([])
    expect(h.calls.played).toBe(0)
  })

  it('reads the article off the dataset by the rule the card prints by', () => {
    // The real port: what the card prints in front of the word is what the
    // tap says in front of it (data/gender.ts, spokenArticle).
    expect(spokenArticleOf('da:hus')).toBe('et')
    expect(spokenArticleOf('da:kat')).toBe('en')
    expect(spokenArticleOf('da:købe')).toBeUndefined()
    // Plurale tantum prints «(com)», which nobody says.
    expect(spokenArticleOf('da:penge')).toBeUndefined()
    expect(spokenArticleOf('not-an-id')).toBeUndefined()
    // Every article the dataset can ask for has a clip in the bake.
    const asked = new Set(WORDS.map((w) => spokenArticleOf(w.id)).filter((a): a is string => !!a))
    expect([...asked].sort()).toEqual(['en', 'et'])
    expect(articleAudioUrl('da:hus', 'et')!.endsWith('audio/da/article/et.mp3')).toBe(true)
    expect(articleAudioUrl('not-an-id', 'et')).toBeUndefined()
  })
})

describe('German City 1 Leda word and phrase playback', () => {
  const article = (id: string) => ({ 'de:Mutter': 'die', 'de:Vater': 'der', 'de:Kind': 'das' })[id]

  it.each([
    ['de:Mutter', 'die'],
    ['de:Vater', 'der'],
    ['de:Kind', 'das'],
  ])('plays %s as one continuous %s+noun recording', async (id, articleText) => {
    const h = harness({ article })
    await expect(h.player.playWord(id)).resolves.toBe('baked')
    expect(h.calls.load).toEqual([city1LedaPhraseAudioUrl(id, articleText)])
    expect(h.calls.playOptions.map((options) => options?.key)).toEqual([`city1-leda-phrase:normal:${id}`])
    expect(h.calls.played).toBe(1)
  })

  it('uses the slow phrase URL and warms that exact URL', async () => {
    const h = harness({ article })
    await h.player.preloadWords(['de:Mutter'], { slow: true })
    expect(h.calls.load).toEqual([
      city1LedaPhraseAudioUrl('de:Mutter', 'die', 'slow'),
      wordAudioUrl('de:Mutter', 'slow'),
    ])
    expect(h.calls.warmed).toEqual(['city1-leda-phrase:slow:de:Mutter', 'slow:de:Mutter'])
    await h.player.playWord('de:Mutter', { slow: true })
    expect(h.calls.load).toHaveLength(2)
    expect(h.calls.playOptions[0]?.url).toBe(city1LedaPhraseAudioUrl('de:Mutter', 'die', 'slow'))
  })

  it('keeps explicit bare playback on the versioned Leda word clip', async () => {
    const h = harness({ article })
    await expect(h.player.playWord('de:Mutter', { article: false })).resolves.toBe('baked')
    expect(h.calls.load).toEqual([city1LedaWordAudioUrl('de:Mutter')])
    expect(h.calls.playOptions.map((options) => options?.key)).toEqual(['normal:de:Mutter'])
  })

  it('plays a non-eligible German word bare', async () => {
    const h = harness({ article: () => undefined })
    await expect(h.player.playWord('de:kommen')).resolves.toBe('baked')
    expect(h.calls.load).toEqual([city1LedaWordAudioUrl('de:kommen')])
  })

  it('reports a missing Leda phrase without requesting an Aoede article or word', async () => {
    const h = harness({ article, async load(url) { h.calls.load.push(url); return { kind: 'absent' } } })
    await expect(h.player.playWord('de:Mutter')).resolves.toBe('failed')
    expect(h.calls.load).toEqual([city1LedaPhraseAudioUrl('de:Mutter', 'die')])
    expect(h.calls.failures).toEqual([{ kind: 'word', reason: 'absent' }])
    expect(h.calls.played).toBe(0)
  })

  it('keeps one-clip playback cancellable and silent when sound is off', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const h = harness({
      article,
      async load(url) {
        h.calls.load.push(url)
        await gate
        return { kind: 'clip', clip: CLIP }
      },
    })
    const pending = h.player.playWord('de:Mutter')
    h.player.stop()
    release!()
    await expect(pending).resolves.toBe('silent')
    expect(h.calls.load).toEqual([city1LedaPhraseAudioUrl('de:Mutter', 'die')])

    const silent = harness({ article, wanted: () => false })
    await expect(silent.player.playWord('de:Mutter')).resolves.toBe('silent')
    expect(silent.calls.load).toEqual([])
    expect(silent.calls.played).toBe(0)
  })
})

/* ------------------------------------------------------------------ *
 * The slow bake
 * ------------------------------------------------------------------ */

describe('the 🐢 in the dictionary sheet', () => {
  it('reads its clip out of the slow directory, by the same slug rule', () => {
    expect(wordAudioUrl('da:hus', 'slow')!.endsWith('audio/da/slow/hus.mp3')).toBe(true)
    // The fold applies on both sides, or the slow half 404s for every word
    // with a Danish letter in it.
    expect(wordAudioUrl('da:købe', 'slow')!.endsWith('audio/da/slow/koebe.mp3')).toBe(true)
    // And 'normal' is what a caller that says nothing gets.
    expect(wordAudioUrl('da:hus')).toBe(wordAudioUrl('da:hus', 'normal'))
  })

  it('fetches its own file rather than replaying the one already in memory', async () => {
    // The regression the variant-keyed memo exists for: keyed by id alone the
    // first tap answers the second, 🐢 plays the ordinary clip, and the button
    // looks dead while behaving perfectly.
    const h = harness()
    await h.player.playWord('da:hus')
    await h.player.playWord('da:hus', { slow: true })
    expect(h.calls.load).toEqual([wordAudioUrl('da:hus'), wordAudioUrl('da:hus', 'slow')])
    expect(h.calls.played).toBe(2)
  })

  it('and a word missing from one bake is not written off in the other', async () => {
    // Same key, same trap: a 404 on the ordinary clip must not make the slow
    // one unaskable for the rest of the session.
    const h = harness()
    h.answers({ kind: 'absent' })
    await h.player.playWord('da:hus')
    h.answers({ kind: 'clip', clip: CLIP })
    await expect(h.player.playWord('da:hus', { slow: true })).resolves.toBe('baked')
    expect(h.calls.load).toEqual([wordAudioUrl('da:hus'), wordAudioUrl('da:hus', 'slow')])
    expect(h.calls.played).toBe(1)
  })

  it('is baked at the pack\'s slow rate rather than stretched', () => {
    // Two files, not one file played slowly: both speeds are real synthesis
    // at the rate they claim, and the pack says which rate the slow one is.
    expect(ACTIVE.speech.slowRate).toBeLessThan(ACTIVE.speech.rate)
  })
})

describe('frozen example sentences', () => {
  it('reports that the listener received the baked Aoede clip', async () => {
    const h = harness()
    await expect(h.player.playExample('da:job')).resolves.toBe('baked')
    expect(h.calls.load).toEqual([exampleAudioUrl('da:job')])
  })

  it('plays the one Aoede performance rather than a second slow source', async () => {
    const h = harness()
    await h.player.playExample('da:job')
    await h.player.playExample('da:job', { slow: true })
    expect(h.calls.load).toEqual([exampleAudioUrl('da:job'), exampleAudioUrl('da:job')])
    expect(h.calls.played).toBe(2)
  })

  it('slows the baked example at 0.8 while preserving pitch', async () => {
    const h = harness()
    await h.player.playExample('da:job', { slow: true })
    expect(h.calls.playOptions).toMatchObject([{ playbackRate: 0.8, preservesPitch: true }])
  })

  it('says so, and reads nothing aloud, when the example clip is absent', async () => {
    const h = harness()
    h.answers({ kind: 'absent' })
    await expect(h.player.playExample('da:job')).resolves.toBe('failed')
    expect(h.calls.played).toBe(0)
    expect(h.calls.failures).toEqual([{ kind: 'example', reason: 'absent' }])
  })
})

describe('accepted curriculum task audio', () => {
  it('plays the versioned task manifest request', async () => {
    const h = harness()
    await expect(h.player.playTask('sonderborg-situation-1-audio-1')).resolves.toBe('baked')
    expect(h.calls.load).toEqual([taskAudioUrl('sonderborg-situation-1-audio-1')])
    expect(h.calls.failures).toEqual([])
  })

  it('reports an unavailable task clip rather than pretending it was recorded', async () => {
    const h = harness()
    h.answers({ kind: 'absent' })
    await expect(h.player.playTask('sonderborg-situation-1-audio-1')).resolves.toBe('failed')
    expect(h.calls.failures).toEqual([{ kind: 'task', reason: 'absent' }])
  })

  it('has nothing to expect for a line the source does not know', async () => {
    const h = harness()
    await expect(h.player.playTask('not-an-accepted-line')).resolves.toBe('silent')
    expect(h.calls.load).toEqual([])
    expect(h.calls.failures).toEqual([])
  })
})

describe('Survival dialogue audio', () => {
  it('plays the versioned Aoede turn', async () => {
    const h = harness()
    const id = 'sonderborg-situation-1-line-1'
    await expect(h.player.playSurvival(id)).resolves.toBe('baked')
    expect(h.calls.load).toEqual([survivalAudioUrl(id)])
    expect(h.calls.failures).toEqual([])
  })

  it('reports a turn whose bake is missing, and reads nothing in its place', async () => {
    const h = harness()
    h.answers({ kind: 'absent' })
    await expect(h.player.playSurvival('sonderborg-situation-1-line-1')).resolves.toBe('failed')
    expect(h.calls.played).toBe(0)
    expect(h.calls.failures).toEqual([{ kind: 'survival', reason: 'absent' }])
  })
})

/**
 * The loader's own reading of a response, which the ported tests above never
 * reach — they stub `load` itself. This is the seam the native shell broke.
 */
describe('deciding whether a response is a clip', () => {
  const ID3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0])
  const SYNC = new Uint8Array([0xff, 0xfb, 0x90, 0x44, 0, 0, 0, 0])
  const HTML = new TextEncoder().encode('<!doctype html><html><body>…') as Uint8Array<ArrayBuffer>

  const answering = async (body: Uint8Array<ArrayBuffer>, init: ResponseInit) => {
    const real = globalThis.fetch
    // A Blob rather than the raw array: BodyInit does not accept a Uint8Array
    // under this project's DOM lib, and a Blob is what fetch hands back anyway.
    globalThis.fetch = (async () => new Response(new Blob([body]), init)) as typeof fetch
    try {
      return await loadBakedClip('/audio/da/hus.mp3')
    } finally {
      globalThis.fetch = real
    }
  }

  it('takes a response that says it is audio', async () => {
    const got = await answering(ID3, { headers: { 'content-type': 'audio/mpeg' } })
    expect(got.kind).toBe('clip')
  })

  /**
   * The regression this exists for. Capacitor's iOS scheme handler answers a
   * media extension with a plain URLResponse rather than an HTTPURLResponse,
   * so there are no headers and `content-type` is empty — and the app read
   * that as "no clip here" and spoke every word, sentence and chapter in the
   * phone's own Danish voice instead of the bake sitting in the bundle.
   */
  it('takes a typeless response whose bytes open like an MP3', async () => {
    expect((await answering(ID3, {})).kind).toBe('clip')
    expect((await answering(SYNC, {})).kind).toBe('clip')
  })

  it('still refuses the single-page fallback, typed or not', async () => {
    expect((await answering(HTML, { headers: { 'content-type': 'text/html' } })).kind).toBe('absent')
    expect((await answering(HTML, {})).kind).toBe('absent')
  })

  it('refuses an empty body and a 404', async () => {
    expect((await answering(new Uint8Array(), {})).kind).toBe('absent')
    expect((await answering(ID3, { status: 404 })).kind).toBe('absent')
  })

  /**
   * The rest of the same regression, which the typeless case above did not
   * reach. A plain URLResponse has no HTTP message at all, and WebKit reports
   * that to `fetch` as status 0 with `ok` false — so the `!res.ok` guard fired
   * before the byte check and every clip on the phone came back `unreachable`.
   * `Response` refuses to be constructed with status 0, which is itself the
   * point: this shape only ever comes from a custom scheme handler, so it is
   * built by hand here.
   */
  const statusZero = async (body: Uint8Array<ArrayBuffer>) => {
    const real = globalThis.fetch
    globalThis.fetch = (async () =>
      ({
        status: 0,
        ok: false,
        headers: new Headers(),
        blob: async () => new Blob([body]),
      }) as unknown as Response) as typeof fetch
    try {
      return await loadBakedClip('/audio/da/hus.mp3')
    } finally {
      globalThis.fetch = real
    }
  }

  it('takes a status-0, header-less response whose bytes are an MP3 (the native shell)', async () => {
    expect((await statusZero(ID3)).kind).toBe('clip')
    expect((await statusZero(SYNC)).kind).toBe('clip')
  })

  it('still refuses status 0 when the bytes are not audio', async () => {
    expect((await statusZero(HTML)).kind).toBe('absent')
    expect((await statusZero(new Uint8Array())).kind).toBe('absent')
  })

  it('still treats a real server error as unreachable, not absent', async () => {
    expect((await answering(ID3, { status: 503 })).kind).toBe('unreachable')
  })
})


describe('City 1 versioned sentence audio', () => {
  it.each([false, true])('reports an unbaked sentence (slow=%s) without fetching any old example, and still plays word-slow audio', async slow => {
    const h = harness()
    expect(await h.player.playCity1Sentence(testRow(), [], { slow })).toBe('failed')
    expect(h.calls.load).toEqual([])
    expect(await h.player.playWord('da:hund', { slow: true })).toBe('baked')
    expect(h.calls.load).toEqual([wordAudioUrl('da:hund', 'slow')])
  })
  it('plays a separately identified normal bake at native rate 1', async () => {
    const h = harness(), row = testRow()
    expect(await h.player.playCity1Sentence(row, [{ audioId: row.audioId, sentenceId: row.sentenceId,
      textDa: row.text.da, version: 1, url: '/audio/da/city1/TEST-v1.mp3', variant: 'normal' as const, bakeRate: 1, playbackRate: 1 }])).toBe('baked')
    expect(h.calls.load[0]).toContain('audio/da/city1/TEST-v1.mp3')
    expect(h.calls.playOptions[0]?.playbackRate).toBeUndefined() // element defaults to 1
  })
})


it('cancels a matched uncached sentence through exported stopWordAudio', async () => {
  const played: string[] = []
  class FakeAudio {
    src = ''; dataset: Record<string, string> = {}; readyState = 1; currentTime = 0
    play() { if (this.dataset.clip) played.push(this.dataset.clip); return Promise.resolve() }
    pause() {} load() {} addEventListener() {} removeEventListener() {} removeAttribute() {}
  }
  let resolve!: (response: Response) => void
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('fetch', () => new Promise<Response>(r => { resolve = r }))
  const row = testRow()
  try {
    const pending = playCity1Sentence(row, [{ audioId: row.audioId, sentenceId: row.sentenceId,
      textDa: row.text.da, version: 1, url: '/audio/da/city1/TEST-cancel.mp3', variant: 'normal' as const, bakeRate: 1, playbackRate: 1 }])
    stopWordAudio()
    resolve(new Response(new Blob(['TEST']), { headers: { 'content-type': 'audio/mpeg' } }))
    expect(await pending).toBe('silent')
    expect(played).toEqual([])
  } finally { stopWordAudio(); vi.unstubAllGlobals() }
})

describe('shared player cancellation', () => {
  const row = testRow()
  const recordings = [{ audioId: row.audioId, sentenceId: row.sentenceId, textDa: row.text.da,
    version: 1, url: '/audio/da/city1/TEST-pending.mp3', variant: 'normal' as const, bakeRate: 1 as const, playbackRate: 1 as const }]
  it.each(['success', 'rejection'] as const)('isolates stale load %s from a new slow-word request after stop', async outcome => {
    let resolve!: (value: ClipLoad) => void, reject!: (reason: Error) => void
    const h = harness({ load: url => url.includes('/city1/')
      ? new Promise<ClipLoad>((yes, no) => { resolve = yes; reject = no })
      : Promise.resolve({ kind: 'clip', clip: CLIP }) })
    const old = h.player.playCity1Sentence(row, recordings)
    h.player.stop()
    expect(await h.player.playWord('da:hund', { slow: true })).toBe('baked')
    const stops = h.calls.stopped
    if (outcome === 'success') resolve({ kind: 'clip', clip: CLIP })
    else reject(new Error('old fetch failed'))
    expect(await old).toBe('silent')
    expect(h.calls.played).toBe(1)
    expect(h.calls.stopped).toBe(stops)
    expect(h.calls.failures).toEqual([])
    expect(await h.player.playWord('da:hund')).toBe('baked')
  })
  it.each(['success', 'rejection'] as const)('ignores stale play %s without stopping the next playback', async outcome => {
    let resolve!: () => void, reject!: (reason: Error) => void
    const h = harness({ play: (_clip, options) => options.url.includes('/city1/')
      ? new Promise<void>((yes, no) => { resolve = yes; reject = no }) : Promise.resolve() })
    await h.player.preloadCity1Sentences([row], recordings)
    const old = h.player.playCity1Sentence(row, recordings)
    h.player.stop()
    expect(await h.player.playWord('da:hund')).toBe('baked')
    const stops = h.calls.stopped
    if (outcome === 'success') resolve(); else reject(new Error('old play aborted'))
    expect(await old).toBe('silent')
    expect(h.calls.stopped).toBe(stops)
    expect(h.calls.failures).toEqual([])
  })

  it('lets an audio scope cancel its pending word request', async () => {
    let release!: (value: ClipLoad) => void
    const h = harness({ load: () => new Promise<ClipLoad>((resolve) => { release = resolve }) })
    const pending = h.player.playWord('da:hus')
    const cancel = h.player.cancellation()

    cancel()
    release({ kind: 'clip', clip: CLIP })

    expect(await pending).toBe('silent')
    expect(h.calls.played).toBe(0)
  })

  it('does not let a stale audio-scope cleanup stop a newer owner', async () => {
    const h = harness()
    await h.player.playWord('da:hus')
    const cancelOld = h.player.cancellation()
    await h.player.playWord('da:kat')
    const stopsAfterNewOwner = h.calls.stopped

    cancelOld()

    expect(h.calls.stopped).toBe(stopsAfterNewOwner)
    expect(h.calls.played).toBe(2)
  })
})

it('instructional audio stays available while all accepted board presentations reject old clips', async () => {
  expect(CITY1_CATALOG.board).toHaveLength(176)
  const h = harness()
  for (const row of CITY1_CATALOG.board) {
    expect(exampleAudioUrl(row.wordId), row.wordId).toContain('/example/')
    expect(await h.player.playCity1Sentence(row, [])).toBe('failed')
  }
  expect(h.calls.load).toEqual([])
})

it('preloads and plays distinct City1 variants at native speed without cache aliasing', async () => {
  const h = harness(), row = testRow()
  const recordings = (['normal', 'slow'] as const).map(variant => ({
    audioId: row.audioId, sentenceId: row.sentenceId, version: row.version, textDa: row.text.da,
    variant, bakeRate: variant === 'normal' ? 1 as const : 0.7 as const, playbackRate: 1 as const,
    url: `/audio/da/city1/TEST-${variant}.mp3`,
  }))
  await h.player.preloadCity1Sentences([row], recordings)
  expect(h.calls.load).toHaveLength(2)
  expect(await h.player.playCity1Sentence(row, recordings)).toBe('baked')
  expect(await h.player.playCity1Sentence(row, recordings, { slow: true })).toBe('baked')
  expect(h.calls.load).toHaveLength(2)
  expect(h.calls.played).toBe(2)
  for (const opts of h.calls.playOptions) expect(opts?.playbackRate ?? 1).toBe(1)
})
