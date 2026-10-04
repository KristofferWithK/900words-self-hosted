import type { RunWordOrigin } from './words'

/**
 * THE ONE WAY OUT OF A RUN.
 *
 * Everything a run tells the rest of the app goes through this interface: a
 * photo the moment it is taken, a miss the moment it happens, and the run's
 * end with its totals. Nothing in the run engine or the screen writes to
 * progression, the journey or any store. The rule cards (CW-02 collecting,
 * CW-04 daily runs) plug a real sink in with `setRunResultsSink`; until then
 * the stub below keeps the last run in memory and writes nothing.
 *
 * Contract notes the sink will need (docs/roadmap/cafe-world.md):
 *  - a photo in Sightseeing is one of a board word's three marks (§3);
 *    connecting words need three photos on different days;
 *  - a run counts against the daily two once its first word is answered (O6):
 *    `answered` > 0 on the end result says so;
 *  - missed words come back more often (§2);
 *  - a missed ARTICLE is not a missed MEANING (CW-06): every photo, miss and
 *    per-word tally says which it was (`kind`), so a noun whose article was
 *    missed in the Articles walk is not counted as a word whose meaning was
 *    missed in the Words walk, and the other way round. `tallyMisses` keeps
 *    the two apart for a sink that remembers misses across runs.
 */

/**
 * The runs: the two walks of Sightseeing (contract §2), and the train run
 * (card CW-07, contract §4): every word of the city, each once, the only way
 * onto the train. The train run asks meanings, like the Words walk.
 */
export type RunWalk = 'words' | 'articles' | 'train'

/**
 * What a gate asked: a word's MEANING (the Words walk) or a noun's ARTICLE
 * (the Articles walk). Results of the two kinds are never mixed.
 */
export type RunAnswerKind = 'meaning' | 'article'

/** The kind of answer each walk asks. */
export function answerKindOf(walk: RunWalk): RunAnswerKind {
  return walk === 'articles' ? 'article' : 'meaning'
}

/**
 * Why a run ended: one wrong word more than the run forgives (`second-wrong`,
 * named for the walks, which forgive one), the player left (Home, Back, the
 * screen closed), or, on the train run only, every word was answered and the
 * train is caught (`caught`).
 */
export type RunEndReason = 'second-wrong' | 'left' | 'caught'

/** A right answer: the photo. */
export interface RunPhoto {
  readonly walk: RunWalk
  /** What was answered right: the word's meaning or the noun's article. */
  readonly kind: RunAnswerKind
  readonly wordId: string
  readonly origin: RunWordOrigin
  /** Epoch ms. */
  readonly at: number
}

/**
 * A wrong answer. `pickedId` is what the player steered into: the id of the
 * wrong word (kind 'meaning'), or the wrong article itself, such as "et"
 * (kind 'article').
 */
export interface RunMiss {
  readonly walk: RunWalk
  /** What was missed: the word's meaning or the noun's article. */
  readonly kind: RunAnswerKind
  readonly wordId: string
  readonly origin: RunWordOrigin
  readonly pickedId: string
  readonly at: number
  /** True when this miss ended the run. */
  readonly ended: boolean
}

/** Per word, over the whole run. */
export interface RunWordTally {
  readonly kind: RunAnswerKind
  readonly wordId: string
  readonly origin: RunWordOrigin
  readonly photos: number
  readonly misses: number
}

export interface RunResult {
  readonly walk: RunWalk
  readonly cityIndex: number
  readonly startedAt: number
  readonly endedAt: number
  readonly end: RunEndReason
  /** Right answers. */
  readonly photos: number
  /** Gates resolved, right or wrong. Zero means the run never really began (O6). */
  readonly answered: number
  /** Wrong words this run forgave before the next one would end it: 1 on a walk, the slips on the train. */
  readonly forgiven: number
  /** The words the run asks in all: every word of the city on the train run, 0 on an endless walk. */
  readonly total: number
  readonly misses: readonly RunMiss[]
  readonly words: readonly RunWordTally[]
}

/** Misses per word id, the two kinds kept apart. */
export interface MissTally {
  readonly meaning: ReadonlyMap<string, number>
  readonly article: ReadonlyMap<string, number>
}

/**
 * Count misses per word, a missed article apart from a missed meaning. A noun
 * missed once in each walk has one of each, never two of either.
 */
export function tallyMisses(misses: Iterable<Pick<RunMiss, 'kind' | 'wordId'>>): MissTally {
  const meaning = new Map<string, number>()
  const article = new Map<string, number>()
  for (const m of misses) {
    const into = m.kind === 'article' ? article : meaning
    into.set(m.wordId, (into.get(m.wordId) ?? 0) + 1)
  }
  return { meaning, article }
}

export interface RunResultsSink {
  photo(photo: RunPhoto): void
  miss(miss: RunMiss): void
  end(result: RunResult): void
}

/** The stub: remembers the last run for a developer to look at, and writes nothing. */
export function createMemoryRunResultsSink(): RunResultsSink & {
  readonly photos: RunPhoto[]
  readonly misses: RunMiss[]
  readonly results: RunResult[]
} {
  const photos: RunPhoto[] = []
  const misses: RunMiss[] = []
  const results: RunResult[] = []
  return {
    photos,
    misses,
    results,
    photo(p) {
      photos.push(p)
    },
    miss(m) {
      misses.push(m)
    },
    end(r) {
      results.push(r)
      // Keep the memory small: a run's events are dropped once it has ended.
      photos.length = 0
      misses.length = 0
      if (results.length > 5) results.shift()
    },
  }
}

let current: RunResultsSink = createMemoryRunResultsSink()

/** The sink a run reports to. */
export function runResultsSink(): RunResultsSink {
  return current
}

/** Plug a real sink in (the rule cards). Returns a function that puts the previous one back. */
export function setRunResultsSink(sink: RunResultsSink): () => void {
  const previous = current
  current = sink
  return () => {
    current = previous
  }
}
