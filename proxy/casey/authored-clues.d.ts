/**
 * Types for the Worker's authored clue bank, so `src/` can name it.
 *
 * The module itself is plain JavaScript and lives with the Worker, which is
 * the copy that ships. This file exists so the pinning test for the baked
 * opening (`src/data/city1OpeningClues.test.ts`) can import the REAL
 * `authoredFirstClue` under `tsc -b` — the parity that makes a stale bake
 * fail a test rather than a round. Only these three signatures are named;
 * the module carries more exports for the Worker's own callers.
 */

export interface AuthoredOpening {
  readonly clue: string
  readonly clueEnglish: string
  readonly targetWordIds: readonly string[]
}

/** Minimal structural shape of the AI clue view this module reads. */
export interface AuthoredView {
  readonly kind: 'ai-clue'
  readonly words: readonly {
    readonly id: string
    readonly da: string
    readonly en: readonly string[]
    readonly pos: string
    readonly reveal: { readonly kind: 'hidden' } | { readonly kind: 'green' } | { readonly kind: 'bystander'; readonly against: readonly string[] }
    readonly roleOnMyKey: 'green' | 'bystander'
  }[]
  readonly history: readonly unknown[]
  readonly boardId?: string
}

export declare function authoredFirstClue(
  view: AuthoredView,
  path?: unknown,
): AuthoredOpening | null