import { beforeEach, describe, expect, it, vi } from 'vitest'

const played: { wordId: string; opts?: { article?: boolean } }[] = []
vi.mock('../ui/speak', async (importOriginal) => {
  const real = await importOriginal<typeof import('../ui/speak')>()
  return {
    ...real,
    playWord: (wordId: string, opts?: { article?: boolean }) => {
      played.push({ wordId, opts })
      return Promise.resolve('baked' as const)
    },
    preloadWordAudio: () => Promise.resolve(),
  }
})

const { RUN_SAYS_ARTICLE, runClipUrl, sayRunWord } = await import('./audio')
const { spokenArticleOf, articlePhraseAudioUrl } = await import('../ui/speak')
const { runWordsForCity } = await import('./sources')

describe('what a run says', () => {
  beforeEach(() => {
    played.length = 0
  })

  it('says a noun WITH its article, in both walks (owner, 2026-10-04)', () => {
    expect(RUN_SAYS_ARTICLE).toBe(true)
    const hus = runWordsForCity(0).find((w) => w.article === 'et')!
    sayRunWord(hus)
    expect(played).toEqual([{ wordId: hus.id, opts: { article: true } }])
  })

  it('so the clip a City 1 noun plays is its article form, «et hus», as everywhere else in the app', () => {
    const nouns = runWordsForCity(0).filter((w) => w.article && w.audio?.kind === 'dataset')
    expect(nouns.length).toBeGreaterThan(20)
    for (const w of nouns) {
      // The word player says this article in front of the word: the run word's own.
      expect(spokenArticleOf(w.id), w.target).toBe(w.article)
      // Sønderborg's nouns have their one-performance article phrase.
      expect(articlePhraseAudioUrl(w.id), w.target).toMatch(/\.mp3/)
    }
  })

  it('plays a connecting word from its own recording', () => {
    const hej = runWordsForCity(0).find((w) => w.origin === 'connecting' && w.target === 'hej')!
    expect(hej.audio).toEqual({ kind: 'clip', language: 'da', key: 'connecting/hej' })
    expect(runClipUrl(hej.audio as { language: string; key: string })).toMatch(/audio\/da\/connecting\/hej\.mp3$/)
  })
})
