/**
 * Timing metadata emitted by S3's chapter bake. `starts` has one offset per
 * accepted Danish model line: offset zero starts the first, every later offset
 * is the end of the detected between-line silence. The browser can therefore
 * highlight and seek without cutting the single performance into clips again.
 */
export interface ChapterTiming {
  readonly id: string
  readonly sourceHash: string
  readonly duration: number
  readonly starts: readonly number[]
}

export interface ChapterTimingManifest {
  readonly language: string
  readonly entries: readonly ChapterTiming[]
}

/**
 * A small, UI-free cancellation lease for the chapter player. A Stop, a newer
 * line tap, and unmount all invalidate the lease before their async work can
 * reach Audio or React state.
 */
export function createChapterPlaybackGeneration() {
  let current = 0
  return {
    begin: () => ++current,
    cancel: () => { current++ },
    isCurrent: (generation: number) => generation === current,
  }
}

/**
 * Start one line of a chapter. A frozen source that no longer describes the
 * displayed chapter is not merely a status: it is an immediate device-voice
 * request for the selected line, including the first Listen line.
 */
export function startChapterPlayback({
  sourceMatches,
  line,
  fallback,
  play,
}: {
  readonly sourceMatches: boolean
  readonly line: number
  readonly fallback: (line: number) => void
  readonly play: (line: number) => void
}): void {
  if (!sourceMatches) {
    fallback(line)
    return
  }
  play(line)
}

/** Which displayed line owns a playback position. */
export function chapterLineAt(starts: readonly number[], time: number): number {
  if (starts.length === 0) return -1
  let current = 0
  for (let index = 1; index < starts.length; index++) {
    if (time < starts[index]!) break
    current = index
  }
  return current
}

/** A timing row is usable only when every displayed line has one increasing start. */
export function usableChapterTiming(
  row: ChapterTiming | undefined,
  id: string,
  sourceHash: string,
  lineCount: number,
): row is ChapterTiming {
  return !!row &&
    row.id === id &&
    row.sourceHash === sourceHash &&
    Number.isFinite(row.duration) && row.duration > 0 &&
    row.starts.length === lineCount &&
    row.starts[0] === 0 &&
    row.starts.every((start, index) =>
      Number.isFinite(start) && start >= 0 && start < row.duration && (index === 0 || start > row.starts[index - 1]!))
}
