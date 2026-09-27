import type { BoardIdentity, CityIdentity, RequiredBoardSet, RequiredSetIdentity, RewardComponent, TutorialAwardIdentity } from './types'

const tuple = (...parts: string[]): string => {
  if (parts.some((part) => typeof part !== 'string' || part.trim().length === 0)) {
    throw new Error('Progress identity contains an empty component')
  }
  return JSON.stringify(parts)
}

export const cityKey = (city: CityIdentity): string => tuple(city.courseId, city.cityId)
export const boardKey = (board: BoardIdentity): string => tuple(board.courseId, board.cityId, board.authoredBoardId, board.contentRevision)
export const requiredSetKey = (set: RequiredSetIdentity): string => tuple(set.courseId, set.cityId, set.setVersion)
export const claimKey = (board: BoardIdentity, component: RewardComponent): string => tuple('claim-v1', boardKey(board), component)
export const tutorialAwardKey = (identity: TutorialAwardIdentity): string => tuple('tutorial-practice-v1', identity.profileKey, identity.courseId, identity.cityId, identity.policyRevision)
/** One completion per board, independent of display order or set version. */
export const firstCompletionKey = (board: BoardIdentity): string => tuple('primary-v1', boardKey(board))
export const receiptKey = (attemptId: string): string => tuple('receipt-v1', attemptId)
export const effectKey = (receiptId: string, effect: string): string => tuple('effect-v1', receiptId, effect)
export const milestoneKey = (set: RequiredSetIdentity, count: number): string => tuple('milestone-v1', requiredSetKey(set), String(count))

export function validateRequiredSet(set: RequiredBoardSet | null): 'missing-manifest' | 'empty-manifest' | 'invalid-manifest' | null {
  if (!set) return 'missing-manifest'
  if (!set.boards.length) return 'empty-manifest'
  try {
    requiredSetKey(set)
    const keys = set.boards.map(boardKey)
    const authoredIds = set.boards.map((board) => board.authoredBoardId)
    if (new Set(keys).size !== keys.length || new Set(authoredIds).size !== keys.length ||
      set.boards.some((board) => cityKey(board) !== cityKey(set))) return 'invalid-manifest'
  } catch { return 'invalid-manifest' }
  return null
}
