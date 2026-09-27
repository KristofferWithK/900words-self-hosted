// Named JSON imports keep private audit/provenance paths out of the client
// graph. The canonical manifest remains intact for offline validators.
import { schemaVersion, kind, status, boardSetVersion, learnerCourse, stableCityId,
  requiredBoardCount, requiredBoards, displayOrder } from './city1-required-board-manifest.da.json'
import germanManifest from './city1-required-board-manifest.de.json'
import { CITY1_BOARD_CYCLES, type City1AuthoredBoard } from './city1BoardCycle'
import { ACTIVE } from '../lang/active'

const EXPECTED_CITY1_REQUIRED_BOARD_COUNT = 100

export interface City1RequiredBoardIdentity {
  readonly courseId: string
  readonly cityId: string
  readonly authoredBoardId: string
  readonly contentRevision: string
}

export interface City1RequiredBoardManifestEntry {
  readonly authoredBoardId: string
  readonly contentRevision: string
}

export interface City1RequiredBoardManifest {
  readonly schemaVersion: number
  readonly kind: string
  readonly status: string
  readonly boardSetVersion: string
  readonly learnerCourse: string
  readonly stableCityId: string
  readonly requiredBoardCount: number
  readonly requiredBoards: readonly City1RequiredBoardManifestEntry[]
  readonly displayOrder: readonly string[]
}

export interface City1RequiredBoard {
  readonly displayIndex: number
  readonly identity: City1RequiredBoardIdentity
  /** The exact object from the retained 150-board authored archive. */
  readonly board: City1AuthoredBoard
}

export interface City1RequiredBoardRegistry {
  readonly setVersion: string
  readonly courseId: string
  readonly cityId: string
  readonly count: number
  readonly idsInDisplayOrder: readonly string[]
  readonly identities: readonly City1RequiredBoardIdentity[]
  has(authoredBoardId: string): boolean
  identityFor(authoredBoardId: string): City1RequiredBoardIdentity
  lookup(authoredBoardId: string): City1RequiredBoard
  at(displayIndex: number): City1RequiredBoard
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const nonemptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`City 1 required-board manifest ${field} must be a nonempty string`)
  }
  return value
}

/**
 * Build the fail-closed view used by queues, achievement reducers and tests.
 *
 * The archive is an input, not the denominator: appending an optional board to
 * the 150-board source cannot silently make it required. Conversely, a
 * required ID absent from the archive is a data error, never a substitute or a
 * completed city. Display order and board-set version stay outside the stable
 * claim identity returned by `identityFor`.
 */
export function createCity1RequiredBoardRegistry(
  manifestValue: unknown,
  archivalBoards: readonly City1AuthoredBoard[],
  options: { expectedCount?: number; allowedStatuses?: readonly string[] } = {},
): City1RequiredBoardRegistry {
  if (!isRecord(manifestValue)) throw new Error('City 1 required-board manifest is missing')
  const manifest = manifestValue as unknown as City1RequiredBoardManifest

  if (manifest.schemaVersion !== 1) throw new Error('City 1 required-board manifest schemaVersion must be 1')
  if (manifest.kind !== 'city1-required-board-manifest') throw new Error('City 1 required-board manifest kind is invalid')
  const allowedStatuses = options.allowedStatuses ?? ['approved-frozen']
  if (!allowedStatuses.includes(manifest.status)) throw new Error('City 1 required-board manifest status is not permitted')
  const setVersion = nonemptyString(manifest.boardSetVersion, 'boardSetVersion')
  const courseId = nonemptyString(manifest.learnerCourse, 'learnerCourse')
  const cityId = nonemptyString(manifest.stableCityId, 'stableCityId')
  if (!Number.isInteger(manifest.requiredBoardCount) || manifest.requiredBoardCount <= 0) {
    throw new Error('City 1 required-board manifest requiredBoardCount must be positive')
  }
  const expectedCount = options.expectedCount ?? EXPECTED_CITY1_REQUIRED_BOARD_COUNT
  if (manifest.requiredBoardCount !== expectedCount) {
    throw new Error(`City 1 required-board manifest requiredBoardCount must be ${expectedCount}`)
  }
  if (!Array.isArray(manifest.requiredBoards) || manifest.requiredBoards.length === 0) {
    throw new Error('City 1 required-board manifest requiredBoards must be nonempty')
  }
  if (manifest.requiredBoards.length !== manifest.requiredBoardCount) {
    throw new Error('City 1 required-board manifest requiredBoardCount does not match requiredBoards')
  }
  if (!Array.isArray(manifest.displayOrder) || manifest.displayOrder.length !== manifest.requiredBoardCount) {
    throw new Error('City 1 required-board manifest displayOrder must contain every required board exactly once')
  }

  const archiveById = new Map<string, City1AuthoredBoard>()
  for (const board of archivalBoards) {
    if (!isRecord(board) || typeof board.id !== 'string' || board.id === '') {
      throw new Error('City 1 authored archive contains a board with no ID')
    }
    if (archiveById.has(board.id)) throw new Error(`City 1 authored archive repeats board ID ${board.id}`)
    archiveById.set(board.id, board)
  }

  const identityById = new Map<string, City1RequiredBoardIdentity>()
  for (const entryValue of manifest.requiredBoards) {
    if (!isRecord(entryValue)) throw new Error('City 1 required-board manifest contains a malformed entry')
    const authoredBoardId = nonemptyString(entryValue.authoredBoardId, 'requiredBoards.authoredBoardId')
    const contentRevision = nonemptyString(entryValue.contentRevision, `${authoredBoardId}.contentRevision`)
    if (identityById.has(authoredBoardId)) {
      throw new Error(`City 1 required-board manifest repeats board ID ${authoredBoardId}`)
    }
    if (!archiveById.has(authoredBoardId)) {
      throw new Error(`City 1 required board ${authoredBoardId} is absent from the authored archive`)
    }
    identityById.set(authoredBoardId, Object.freeze({
      courseId,
      cityId,
      authoredBoardId,
      contentRevision,
    }))
  }

  const seenDisplayIds = new Set<string>()
  const ordered = manifest.displayOrder.map((idValue, displayIndex) => {
    const authoredBoardId = nonemptyString(idValue, `displayOrder[${displayIndex}]`)
    if (seenDisplayIds.has(authoredBoardId)) {
      throw new Error(`City 1 required-board displayOrder repeats board ID ${authoredBoardId}`)
    }
    seenDisplayIds.add(authoredBoardId)
    const identity = identityById.get(authoredBoardId)
    if (!identity) throw new Error(`City 1 required-board displayOrder names nonmember ${authoredBoardId}`)
    return Object.freeze({
      displayIndex,
      identity,
      board: archiveById.get(authoredBoardId)!,
    })
  })
  if (seenDisplayIds.size !== identityById.size) {
    const missing = [...identityById.keys()].filter((id) => !seenDisplayIds.has(id))
    throw new Error(`City 1 required-board displayOrder omits ${missing.join(', ')}`)
  }

  const orderedById = new Map(ordered.map((entry) => [entry.identity.authoredBoardId, entry]))
  const idsInDisplayOrder = Object.freeze(ordered.map((entry) => entry.identity.authoredBoardId))
  const identities = Object.freeze([...identityById.values()])

  const lookup = (authoredBoardId: string): City1RequiredBoard => {
    const entry = orderedById.get(authoredBoardId)
    if (!entry) throw new Error(`Unknown City 1 required board ID: ${authoredBoardId}`)
    return entry
  }

  return Object.freeze({
    setVersion,
    courseId,
    cityId,
    count: ordered.length,
    idsInDisplayOrder,
    identities,
    has: (authoredBoardId: string) => orderedById.has(authoredBoardId),
    identityFor: (authoredBoardId: string) => lookup(authoredBoardId).identity,
    lookup,
    at: (displayIndex: number) => {
      if (!Number.isInteger(displayIndex) || displayIndex < 0 || displayIndex >= ordered.length) {
        throw new Error(`Unknown City 1 required-board display index: ${displayIndex}`)
      }
      return ordered[displayIndex]!
    },
  })
}

export const CITY1_REQUIRED_BOARD_MANIFEST: City1RequiredBoardManifest = {
  schemaVersion, kind, status, boardSetVersion, learnerCourse, stableCityId,
  requiredBoardCount, requiredBoards, displayOrder,
}
export const GERMAN_CITY1_REQUIRED_BOARD_MANIFEST = germanManifest as City1RequiredBoardManifest
export const DANISH_CITY1_REQUIRED_BOARDS = createCity1RequiredBoardRegistry(
  CITY1_REQUIRED_BOARD_MANIFEST,
  CITY1_BOARD_CYCLES.da,
)
export const GERMAN_CITY1_REQUIRED_BOARDS = createCity1RequiredBoardRegistry(
  GERMAN_CITY1_REQUIRED_BOARD_MANIFEST,
  CITY1_BOARD_CYCLES.de,
  { expectedCount: 150, allowedStatuses: ['owner-authorized-playtest'] },
)
export const CITY1_REQUIRED_BOARDS = ACTIVE.code === 'de'
  ? GERMAN_CITY1_REQUIRED_BOARDS
  : DANISH_CITY1_REQUIRED_BOARDS

export const CITY1_REQUIRED_BOARD_SET_VERSION = CITY1_REQUIRED_BOARDS.setVersion
export const CITY1_REQUIRED_BOARD_COUNT = CITY1_REQUIRED_BOARDS.count
export const CITY1_REQUIRED_BOARD_IDS = CITY1_REQUIRED_BOARDS.idsInDisplayOrder
export const CITY1_REQUIRED_BOARD_IDENTITIES = CITY1_REQUIRED_BOARDS.identities

export const isCity1RequiredBoardId = (authoredBoardId: string): boolean =>
  CITY1_REQUIRED_BOARDS.has(authoredBoardId)

export const city1RequiredBoardIdentityById = (
  authoredBoardId: string,
): City1RequiredBoardIdentity => CITY1_REQUIRED_BOARDS.identityFor(authoredBoardId)

export const city1RequiredBoardById = (authoredBoardId: string): City1RequiredBoard =>
  CITY1_REQUIRED_BOARDS.lookup(authoredBoardId)

export const city1RequiredBoardAt = (displayIndex: number): City1RequiredBoard =>
  CITY1_REQUIRED_BOARDS.at(displayIndex)
