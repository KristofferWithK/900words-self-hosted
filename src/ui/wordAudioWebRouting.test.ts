import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Words play through Web Audio by default (TestFlight 126): the four word
 * calls of speak.ts go to the Web Audio player and no word element is made.
 * The performance log's "Old word-players" switch (`elementWords`) restores
 * the element path as it was: the Web Audio player is never asked for
 * anything, and no AudioContext is made. So does a page with no Web Audio.
 */
const web = vi.hoisted(() => ({
  webWords: {
    playWord: vi.fn(() => Promise.resolve('baked' as const)),
    preloadWords: vi.fn(() => Promise.resolve()),
    playClip: vi.fn(() => Promise.resolve('baked' as const)),
    preloadClips: vi.fn(() => Promise.resolve()),
    prime: vi.fn(),
    stop: vi.fn(),
    available: vi.fn(() => true),
  },
}))
vi.mock('./wordAudioWeb', () => web)
const audioContext = vi.hoisted(() => ({ getAudioContext: vi.fn(), resumeAudioContext: vi.fn() }))
vi.mock('./audioContext', () => audioContext)

class FakeAudio {
  static made = 0
  preload = ''
  src = ''
  dataset: Record<string, string> = {}
  readyState = 4
  networkState = 1
  currentTime = 0
  paused = true
  playbackRate = 1
  preservesPitch = true
  constructor() {
    FakeAudio.made++
  }
  addEventListener() {}
  removeEventListener() {}
  load() {}
  play() {
    return Promise.resolve()
  }
  pause() {}
}

const fetched: string[] = []

beforeEach(() => {
  FakeAudio.made = 0
  fetched.length = 0
  for (const fn of Object.values(web.webWords)) fn.mockClear()
  audioContext.getAudioContext.mockClear()
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('fetch', (url: string) => {
    fetched.push(url)
    return Promise.resolve(new Response(new Uint8Array([0x49, 0x44, 0x33, 0, 0]), { headers: { 'content-type': 'audio/mpeg' } }))
  })
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:clip')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(async () => {
  const { setDiagSwitch, DIAG_SWITCHES } = await import('./diagnostics/switches')
  for (const name of DIAG_SWITCHES) setDiagSwitch(name, false)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('words through Web Audio by default', () => {
  const elementPath = async () => {
    const speak = await import('./speak')
    speak.elementPoolForTests.clear()
    await speak.preloadWordAudio(['da:hus'])
    await speak.preloadClipAudio(['/audio/da/connecting/og.mp3'])
    speak.primeWordAudio()
    await expect(speak.playWord('da:bog', { article: false })).resolves.toBe('baked')
    await expect(speak.playClipAudio('/audio/da/connecting/og.mp3')).resolves.toBe('baked')
    expect(web.webWords.playWord).not.toHaveBeenCalled()
    expect(web.webWords.preloadWords).not.toHaveBeenCalled()
    expect(web.webWords.playClip).not.toHaveBeenCalled()
    expect(web.webWords.preloadClips).not.toHaveBeenCalled()
    expect(web.webWords.prime).not.toHaveBeenCalled()
    expect(audioContext.getAudioContext).not.toHaveBeenCalled()
    // The element player made its own elements (the bytes may be memoised from an earlier test).
    expect(FakeAudio.made).toBeGreaterThan(0)
    expect(speak.elementPoolForTests.size).toBeGreaterThan(0)
  }

  it('default: the four word calls and the prime go to the Web Audio player, and no word element is made', async () => {
    const speak = await import('./speak')
    speak.elementPoolForTests.clear()
    // The prime still unlocks the one shared chapter element in a browser
    // (not in the shell); that element is not a word's.
    speak.primeWordAudio()
    const made = FakeAudio.made
    fetched.length = 0
    await speak.preloadWordAudio(['da:hus'], { slow: true })
    await speak.preloadClipAudio(['/x.mp3'])
    await expect(speak.playWord('da:hus', { article: false })).resolves.toBe('baked')
    await expect(speak.playClipAudio('/x.mp3')).resolves.toBe('baked')
    speak.primeWordAudio()
    expect(web.webWords.preloadWords).toHaveBeenCalledWith(['da:hus'], { slow: true })
    expect(web.webWords.preloadClips).toHaveBeenCalledWith(['/x.mp3'])
    expect(web.webWords.playWord).toHaveBeenCalledWith('da:hus', { article: false })
    expect(web.webWords.playClip).toHaveBeenCalledWith('/x.mp3')
    expect(web.webWords.prime).toHaveBeenCalled()
    expect(fetched).toEqual([])
    expect(FakeAudio.made).toBe(made)
    expect(speak.elementPoolForTests.size).toBe(0)
  })

  it('"Old word-players" on: every word call takes the element path; the Web Audio player is never asked', async () => {
    const { setDiagSwitch } = await import('./diagnostics/switches')
    setDiagSwitch('elementWords', true)
    await elementPath()
  })

  it('a page with no Web Audio keeps the element path', async () => {
    web.webWords.available.mockReturnValue(false)
    try {
      await elementPath()
    } finally {
      web.webWords.available.mockReturnValue(true)
    }
  })

  it('a device that stored the retired opt-in `webAudioWords` simply gets the default', async () => {
    const store = new Map<string, string>([['cluecab-diag-switches', JSON.stringify({ webAudioWords: true })]])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    const { reloadDiagSwitches, diagSwitchesOn } = await import('./diagnostics/switches')
    reloadDiagSwitches()
    expect(diagSwitchesOn()).toEqual([])
    const speak = await import('./speak')
    await speak.playWord('da:hus')
    expect(web.webWords.playWord).toHaveBeenCalled()
  })

  it('a word tap still stops what the element player is saying; stopping words stops the Web Audio words', async () => {
    const speak = await import('./speak')
    web.webWords.stop.mockClear()
    await speak.playWord('da:hus')
    expect(web.webWords.stop).toHaveBeenCalled()
    web.webWords.stop.mockClear()
    speak.stopWordAudio()
    expect(web.webWords.stop).toHaveBeenCalledTimes(1)
  })

  it('Mute words still wins: nothing is said either way', async () => {
    const speak = await import('./speak')
    const { setDiagSwitch } = await import('./diagnostics/switches')
    setDiagSwitch('wordAudio', true)
    await expect(speak.playWord('da:hus')).resolves.toBe('silent')
    await expect(speak.playClipAudio('/x.mp3')).resolves.toBe('silent')
    setDiagSwitch('elementWords', true)
    await expect(speak.playWord('da:hus')).resolves.toBe('silent')
    expect(web.webWords.playWord).not.toHaveBeenCalled()
    expect(web.webWords.playClip).not.toHaveBeenCalled()
    expect(FakeAudio.made).toBe(0)
  })
})
