// Named JSON imports keep private audit/provenance paths out of the client
// graph. The canonical manifest remains intact for offline validators.
import { schemaVersion, kind, status, boardSetVersion, learnerCourse, stableCityId,
  requiredBoardCount, requiredBoards, displayOrder } from './city1-required-board-manifest.da.json'
import { schemaVersion as v1SchemaVersion, kind as v1Kind, status as v1Status, boardSetVersion as v1BoardSetVersion,
  learnerCourse as v1LearnerCourse, stableCityId as v1StableCityId, requiredBoardCount as v1RequiredBoardCount,
  requiredBoards as v1RequiredBoards, displayOrder as v1DisplayOrder } from './city1-required-board-manifest.da.v1.json'
import { schemaVersion as deSchemaVersion, kind as deKind, status as deStatus, boardSetVersion as deBoardSetVersion,
  learnerCourse as deLearnerCourse, stableCityId as deStableCityId, requiredBoardCount as deRequiredBoardCount,
  requiredBoards as deRequiredBoards, displayOrder as deDisplayOrder } from './city1-required-board-manifest.de.json'
import germanManifestV1 from './city1-required-board-manifest.de.v1.json'
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
/**
 * German City 1 plays the Danish course board for board: the v2 ids in the v2
 * order, over the German cards of the same boards (owner, 2026-09-27, the
 * universality approach; written by scripts/german-city1-course.mjs).
 */
export const GERMAN_CITY1_REQUIRED_BOARD_MANIFEST: City1RequiredBoardManifest = {
  schemaVersion: deSchemaVersion, kind: deKind, status: deStatus, boardSetVersion: deBoardSetVersion,
  learnerCourse: deLearnerCourse, stableCityId: deStableCityId, requiredBoardCount: deRequiredBoardCount,
  requiredBoards: deRequiredBoards, displayOrder: deDisplayOrder,
}
/**
 * The 150-board German playtest set it supersedes. Kept byte for byte for the
 * same reason as the Danish v1: a German save names it.
 */
export const GERMAN_CITY1_REQUIRED_BOARD_MANIFEST_V1 = germanManifestV1 as City1RequiredBoardManifest
export const DANISH_CITY1_REQUIRED_BOARDS = createCity1RequiredBoardRegistry(
  CITY1_REQUIRED_BOARD_MANIFEST,
  CITY1_BOARD_CYCLES.da,
)

/**
 * The first frozen Danish set, `city1-required-boards-v1`, superseded on
 * 2026-09-27 by the balanced v2 above (owner decision, DECISIONS.md). It is
 * not a course any more: nothing deals from it and no new claim names it. It is
 * kept, byte-for-byte, because saved facts do name it: first completions,
 * milestones and a city medal written while it was current still carry its
 * set version, and a backup holding them must keep validating. Its boards stay
 * known provenance for the same reason (`knownRequiredSetsForCourse`).
 */
export const DANISH_CITY1_REQUIRED_BOARD_MANIFEST_V1: City1RequiredBoardManifest = {
  schemaVersion: v1SchemaVersion, kind: v1Kind, status: v1Status, boardSetVersion: v1BoardSetVersion,
  learnerCourse: v1LearnerCourse, stableCityId: v1StableCityId, requiredBoardCount: v1RequiredBoardCount,
  requiredBoards: v1RequiredBoards, displayOrder: v1DisplayOrder,
}
export const DANISH_CITY1_REQUIRED_BOARDS_V1 = createCity1RequiredBoardRegistry(
  DANISH_CITY1_REQUIRED_BOARD_MANIFEST_V1,
  CITY1_BOARD_CYCLES.da,
)
export const GERMAN_CITY1_REQUIRED_BOARDS = createCity1RequiredBoardRegistry(
  GERMAN_CITY1_REQUIRED_BOARD_MANIFEST,
  CITY1_BOARD_CYCLES.de,
  { allowedStatuses: ['owner-authorized-playtest'] },
)
export const GERMAN_CITY1_REQUIRED_BOARDS_V1 = createCity1RequiredBoardRegistry(
  GERMAN_CITY1_REQUIRED_BOARD_MANIFEST_V1,
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
