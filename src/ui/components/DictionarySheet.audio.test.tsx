import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

const hooks = vi.hoisted(() => ({ effects: [] as Array<() => unknown>, feedback: vi.fn() }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useEffect: (effect: () => unknown) => hooks.effects.push(effect),
  useLayoutEffect: (effect: () => unknown) => hooks.effects.push(effect),
  useState: () => [undefined, hooks.feedback],
}))
vi.mock('../../stores/uiStore', async original => {
  const actual = await original<typeof import('../../stores/uiStore')>()
  return { ...actual, useUi: Object.assign((select?: (state: ReturnType<typeof actual.useUi.getState>) => unknown) => select ? select(actual.useUi.getState()) : actual.useUi.getState(), actual.useUi) }
})
vi.mock('../../stores/gameStore', () => ({ useGame: (select: (s: unknown) => unknown) => select({ mode: 'playing', packingDone: true, recordLookup: vi.fn() }) }))
vi.mock('../useDialog', () => ({ useDialog: () => undefined }))
vi.mock('../speak', async original => ({ ...await original<typeof import('../speak')>(),
  preloadWordAudio: vi.fn(), preloadExampleAudio: vi.fn(), preloadCity1Sentences: vi.fn(),
}))
import { UI } from '../../i18n'
import { DictionarySheet, useOpenDictionary } from './DictionarySheet'
import { useUi } from '../../stores/uiStore'
import { useSettings } from '../../stores/settingsStore'
import { playExample, playWord, stopWordAudio } from '../speak'

const played: Array<{ url: string; rate: number }> = []
class FakeAudio {
  src = ''; dataset: Record<string, string> = {}; readyState = 1; currentTime = 0; playbackRate = 1
  play() { if (this.dataset.clip) played.push({ url: this.dataset.clip, rate: this.playbackRate }); return Promise.resolve() }
  pause = vi.fn(); load() {} addEventListener() {} removeEventListener() {} removeAttribute() {}
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const response = () => new Response(new Blob(['TEST']), { headers: { 'content-type': 'audio/mpeg' } })
function button(node: unknown, label: string): { onClick: () => void } | undefined {
  if (!node || typeof node !== 'object') return
  const props = (node as ReactElement<{ 'aria-label'?: string; onClick: () => void; children?: unknown }>).props
  if (!props) return
  if (props['aria-label'] === label) return props
  for (const child of [props.children].flat(Infinity)) { const found = button(child, label); if (found) return found }
}
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 20)) }
beforeEach(() => {
  stopWordAudio(); useUi.getState().closeSheet(); played.length = 0; hooks.effects = []; hooks.feedback.mockClear()
  useSettings.setState({ sound: true, playExampleOnLookup: true })
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('fetch', vi.fn(async () => response()))
})
afterEach(() => { stopWordAudio(); useUi.getState().closeSheet(); vi.unstubAllGlobals() })

describe('actual instructional playback export', () => {
  it.each(['film', 'mor', 'job'])('slows the original %s example to 0.8', async word => {
    expect(await playExample(`da:${word}`, { slow: true })).toBe('baked')
    expect(played.at(-1)).toMatchObject({ rate: 0.8 })
    expect(played.at(-1)?.url).toContain(`/example/${word}.mp3`)
  })
})

describe('dictionary audio ownership', () => {
  it.each(['close', 'context', 'word', 'navigate', 'guide', 'train', 'back', 'unmount'])(
    'cancels delayed old example on %s and ignores feedback', async transition => {
      const pending = deferred<Response>()
      vi.stubGlobal('fetch', () => pending.promise)
      useUi.getState().openSheet('da:film')
      const tree = DictionarySheet()
      const cleanups = hooks.effects.map(effect => effect()).filter((value): value is () => void => typeof value === 'function')
      button(tree, UI.game.sayExampleAria)!.onClick()
      if (transition === 'close') { useUi.getState().closeSheet(); useUi.getState().openSheet('da:mor', { kind: 'board', cityIndex: 0 }) }
      if (transition === 'context') useUi.getState().openSheet('da:film', { kind: 'board', cityIndex: 0 })
      if (transition === 'word') useUi.getState().openSheet('da:mor')
      if (transition === 'navigate') useUi.getState().goTo('settings')
      if (transition === 'guide') useUi.getState().openGuide({ kind: 'grammar', cityIndex: 0 })
      if (transition === 'train') useUi.getState().boardTrain(0)
      if (transition === 'back') useUi.setState({ sheetWordId: null })
      if (transition === 'unmount') cleanups.forEach(cleanup => cleanup())
      hooks.feedback.mockClear()
      pending.resolve(response()); await flush()
      expect(played).toEqual([])
      expect(hooks.feedback).not.toHaveBeenCalled()
    },
  )
  it.each(['success', 'rejection'] as const)('preserves newer card audio and ignores stale %s', async outcome => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', (url: string) => url.includes('/example/') ? pending.promise : Promise.resolve(response()))
    useUi.getState().openSheet('da:film')
    const tree = DictionarySheet()
    const cleanups = hooks.effects.map(effect => effect()).filter((value): value is () => void => typeof value === 'function')
    button(tree, UI.game.sayExampleAria)!.onClick()
    // Card pointerdown starts the new request BEFORE openSheet or old cleanup.
    const desired = playWord('da:mor', { article: false })
    useUi.getState().openSheet('da:mor', { kind: 'board', cityIndex: 0 })
    cleanups.forEach(cleanup => cleanup())
    hooks.feedback.mockClear()
    expect(await desired).toBe('baked')
    if (outcome === 'success') pending.resolve(response()); else pending.reject(new Error('old fetch failed'))
    await flush()
    expect(played).toHaveLength(1)
    expect(played[0].url).toContain('/mor.mp3')
    expect(hooks.feedback).not.toHaveBeenCalled()
  })
})


it('opens a lookup before assigning its new audio ownership; old cleanup preserves it', async () => {
  useUi.getState().openSheet('da:film')
  DictionarySheet()
  const cleanups = hooks.effects.map(effect => effect()).filter((value): value is () => void => typeof value === 'function')
  const open = useOpenDictionary({ kind: 'instructional' })
  open('da:mor')
  cleanups.forEach(cleanup => cleanup())
  await flush()
  expect(played).toHaveLength(1)
  expect(played[0].url).toContain('/example/mor.mp3')
})

it('uses the word-audio path for a lookup when sentence audio is off', async () => {
  useSettings.setState({ playExampleOnLookup: false })
  const open = useOpenDictionary({ kind: 'instructional' })
  open('da:mor')
  await flush()
  expect(played).toHaveLength(1)
  // «mor» is a City 1 noun: one «en mor» performance, not the article clip.
  expect(played[0].url).toContain('/audio/da/phrase/en-mor.mp3')
  expect(played[0].url).not.toContain('/example/')
})

it.each([true, false])('always opens a board lookup with the one «en mor» performance when playExampleOnLookup is %s', async playExampleOnLookup => {
  useSettings.setState({ playExampleOnLookup })
  useOpenDictionary({ kind: 'board', cityIndex: 0 })('da:mor')
  // Waits past ARTICLE_MAX_MS on purpose: a chained article would have
  // brought the word in by now, and a City 1 noun must never chain.
  await new Promise(resolve => setTimeout(resolve, 1250))
  expect(played).toHaveLength(1)
  expect(played[0]!.url).toContain('/audio/da/phrase/en-mor.mp3')
  expect(played.some(({ url }) => url.includes('/article/') || url.includes('/example/'))).toBe(false)
})

it('keeps a lookup quiet when both sentence and word audio are off', async () => {
  useSettings.setState({ sound: false, playExampleOnLookup: false })
  useOpenDictionary({ kind: 'instructional' })('da:mor')
  await flush()
  expect(played).toEqual([])
})

it.each(['success', 'rejection'] as const)('ignores superseded feedback %s while preserving current failure feedback', async outcome => {
  useUi.getState().openSheet('da:mor')
  const scope = useUi.getState().sheetAudio
  const old = deferred<import('../speak').PlaybackSource>()
  scope.run(() => old.promise, hooks.feedback)
  scope.run(() => Promise.resolve('failed'), hooks.feedback)
  await flush()
  expect(hooks.feedback.mock.calls).toEqual([['failed']])
  if (outcome === 'success') old.resolve('baked'); else old.reject(new Error('old playback rejected'))
  await flush()
  expect(hooks.feedback.mock.calls).toEqual([['failed']])
})

// This pair used to assert the EMPTY manifest's behaviour: with no City 1
// bake, the sheet in a City 1 board context played nothing rather than
// borrowing the instructional `example/` clip. The bake landed on 2026-09-11
// (704 recordings), so the invariant is now the other half of the same rule —
// it plays the City 1 recording, and still never the instructional one.
it.each([
  [UI.game.sayExampleAria, 'normal'],
  [UI.game.sayExampleSlowlyAria, 'slow'],
] as const)(
  'plays the City1 recording on %s without borrowing instructional audio', async (label, variant) => {
    useUi.getState().openSheet('da:mor', { kind: 'board', cityIndex: 0 })
    const tree = DictionarySheet()
    expect(button(tree, label)).toBeDefined()
    button(tree, label)!.onClick()
    await flush()
    expect(played).toHaveLength(1)
    // Its own versioned path, ASCII-slugged — not `example/mor.mp3`, and at
    // native speed: the slow one is a real 0.7 bake, not a stretched clip.
    expect(played[0]!.url).toContain(`/audio/da/city1/board/mor/v1/${variant}.mp3`)
    expect(played[0]!.url).not.toContain('/example/')
    expect(played[0]!.rate).toBe(1)
    expect(hooks.feedback).not.toHaveBeenCalledWith('failed')
  },
)
