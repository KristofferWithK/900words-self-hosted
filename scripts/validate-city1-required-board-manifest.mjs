#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = 'src/data/city1-required-board-manifest.da.json'
const EXPECTED_COUNT = 100
const EXPECTED_ARCHIVE_COUNT = 150
const EXPECTED_APPROVAL_SHA = '497382e8a3f73fd9def667fbe790d126400782b0'
const EXPECTED_AUDIT_BASE_SHA = '54280eea53ffb3a8ffcdb862530fda554e2d8954'

const fail = (message) => { throw new Error(message) }
const need = (condition, message) => { if (!condition) fail(message) }
const exactArray = (left, right) =>
  Array.isArray(left) && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => value === right[index])
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const normalizedClue = (value) => value.normalize('NFC').trim().toLocaleLowerCase('da-DK')

function readArtifact(path) {
  need(typeof path === 'string' && path.length > 0, 'artifact path must be a nonempty string')
  const absolute = resolve(ROOT, path)
  need(absolute === ROOT || absolute.startsWith(`${ROOT}\\`) || absolute.startsWith(`${ROOT}/`), `${path} escapes the repository`)
  const bytes = readFileSync(absolute)
  return { path, bytes, sha256: sha256(bytes), text: bytes.toString('utf8') }
}

function readJson(path) {
  const artifact = readArtifact(path)
  return { ...artifact, json: JSON.parse(artifact.text) }
}

function validateFilePin(pin, label, json = true) {
  need(pin && typeof pin === 'object', `${label} pin is missing`)
  need(typeof pin.path === 'string' && typeof pin.sha256 === 'string', `${label} pin is malformed`)
  const artifact = json ? readJson(pin.path) : readArtifact(pin.path)
  need(artifact.sha256 === pin.sha256, `${label} hash differs: ${artifact.sha256} != ${pin.sha256}`)
  return artifact
}

function validateManifestShape(manifest) {
  need(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'required-board manifest is missing')
  need(manifest.schemaVersion === 1, 'required-board manifest schemaVersion must be 1')
  need(manifest.kind === 'city1-required-board-manifest', 'required-board manifest kind is invalid')
  need(manifest.status === 'approved-frozen', 'required-board manifest must be approved-frozen')
  need(manifest.boardSetVersion === 'city1-required-boards-v1', 'required-board set version drifted')
  need(manifest.learnerCourse === 'da', 'required-board learner course must be da')
  need(manifest.stableCityId === 'sonderborg', 'required-board stable city ID must be sonderborg')
  need(manifest.requiredBoardCount === EXPECTED_COUNT, `required-board count must be ${EXPECTED_COUNT}`)
  need(exactArray(manifest.claimIdentityFields, ['courseId', 'cityId', 'authoredBoardId', 'contentRevision']), 'claim identity fields drifted')
  need(manifest.contentRevisionRule?.initialRevision === '1', 'initial content revision must be the string "1"')
  need(
    exactArray(manifest.contentRevisionRule?.requiresSuccessorMappingFor, ['wordIds', 'playerGreenIds', 'aiGreenIds']),
    'content revision successor fields drifted',
  )
  need(
    exactArray(
      manifest.contentRevisionRule?.doesNotRemintClaims,
      ['boardSetVersion', 'displayOrder', 'seedHex', 'firstGiver', 'clueOrLocalizationText'],
    ),
    'content revision non-identity fields drifted',
  )
  need(manifest.sources?.approvedAtSourceSha === EXPECTED_APPROVAL_SHA, 'approval source SHA drifted')
  need(manifest.sources?.candidateAuditBaseSha === EXPECTED_AUDIT_BASE_SHA, 'candidate audit base SHA drifted')
  need(Array.isArray(manifest.requiredBoards) && manifest.requiredBoards.length > 0, 'requiredBoards must be nonempty')
  need(manifest.requiredBoards.length === manifest.requiredBoardCount, 'requiredBoards length differs from requiredBoardCount')
  need(Array.isArray(manifest.displayOrder) && manifest.displayOrder.length === manifest.requiredBoardCount, 'displayOrder length differs from requiredBoardCount')

  const memberIds = []
  const memberSet = new Set()
  for (const [index, entry] of manifest.requiredBoards.entries()) {
    need(entry && typeof entry === 'object' && !Array.isArray(entry), `requiredBoards[${index}] is malformed`)
    need(typeof entry.authoredBoardId === 'string' && entry.authoredBoardId.length > 0, `requiredBoards[${index}] has no authoredBoardId`)
    need(typeof entry.contentRevision === 'string' && entry.contentRevision.length > 0, `${entry.authoredBoardId} contentRevision must be a nonempty string`)
    need(entry.contentRevision === manifest.contentRevisionRule.initialRevision, `${entry.authoredBoardId} contentRevision differs from the approved initial revision`)
    need(!memberSet.has(entry.authoredBoardId), `requiredBoards repeats ${entry.authoredBoardId}`)
    memberSet.add(entry.authoredBoardId)
    memberIds.push(entry.authoredBoardId)
  }

  const displaySet = new Set()
  for (const id of manifest.displayOrder) {
    need(typeof id === 'string' && id.length > 0, 'displayOrder contains a missing ID')
    need(!displaySet.has(id), `displayOrder repeats ${id}`)
    need(memberSet.has(id), `displayOrder names nonmember ${id}`)
    displaySet.add(id)
  }
  need(displaySet.size === memberSet.size, 'displayOrder omits a required board')
  return { memberIds, memberSet }
}

function loadProduction(manifest) {
  const sources = {
    roster: validateFilePin(manifest.sources?.roster, 'roster'),
    words: validateFilePin(manifest.sources?.words, 'words'),
    cycle: validateFilePin(manifest.sources?.archivalCycle, 'archival cycle'),
    workerAuthoredClues: validateFilePin(manifest.sources?.workerAuthoredClues, 'Worker authored clues'),
    workerPlayerKeys: validateFilePin(manifest.sources?.workerPlayerKeys, 'Worker player keys'),
    workerLegalClues: validateFilePin(manifest.sources?.workerLegalClues, 'Worker legal clues'),
    workerAssociationIndex: validateFilePin(manifest.sources?.workerAssociationIndex, 'Worker association index'),
    workerLcsi: validateFilePin(manifest.sources?.workerLcsi, 'Worker LCSI'),
    clientOpeningClues: validateFilePin(manifest.sources?.clientOpeningClues, 'client opening clues'),
    clientPlaytestClues: validateFilePin(manifest.sources?.clientPlaytestClues, 'client playtest clues'),
  }
  const evidence = {
    candidate: validateFilePin(manifest.approvedEvidence?.candidate, 'C1-02 candidate'),
    coverage: validateFilePin(manifest.approvedEvidence?.coverage, 'C1-02 coverage'),
    report: validateFilePin(manifest.approvedEvidence?.report, 'C1-02 coverage report', false),
  }
  return { sources, evidence }
}

function validateEvidencePins(manifest, loaded) {
  const { sources, evidence } = loaded
  const candidate = evidence.candidate.json
  const coverage = evidence.coverage.json
  need(candidate.schemaVersion === 1 && candidate.kind === 'city1-required-board-candidate-v1', 'C1-02 candidate kind/schema drifted')
  need(candidate.auditBaseSha === EXPECTED_AUDIT_BASE_SHA, 'C1-02 candidate audit base drifted')
  need(candidate.selection?.target === EXPECTED_COUNT && candidate.selection?.actual === EXPECTED_COUNT, 'C1-02 candidate count is not 100/100')
  need(candidate.validation?.distinctExistingBoards === EXPECTED_COUNT, 'C1-02 candidate distinct-board validation drifted')
  need(candidate.validation?.missingPlayerKeyPairs === 0 && candidate.validation?.missingCaseyKeyPairs === 0, 'C1-02 candidate has a hard coverage gap')
  need(candidate.validation?.workerAndClientLookupMappings === EXPECTED_COUNT, 'C1-02 candidate lookup count drifted')
  need(candidate.rosterSha256 === manifest.sources.roster.sha256, 'C1-02 candidate roster hash differs from the manifest')
  need(candidate.cycleSha256 === manifest.sources.archivalCycle.sha256, 'C1-02 candidate cycle hash differs from the manifest')
  need(candidate.cycleSourceSha256 === manifest.sources.archivalCycle.sourceSha256, 'C1-02 candidate cycle source hash differs from the manifest')

  need(coverage.schemaVersion === 1 && coverage.kind === 'city1-board-coverage-audit-v1', 'C1-02 coverage kind/schema drifted')
  need(coverage.auditBaseSha === EXPECTED_AUDIT_BASE_SHA && coverage.noLiveCalls === true, 'C1-02 coverage provenance drifted')
  need(coverage.selection?.targetBoards === EXPECTED_COUNT && coverage.selection?.selectedBoards === EXPECTED_COUNT, 'C1-02 coverage selection count drifted')
  need(coverage.validation?.candidateDirectionalCoverage === true, 'C1-02 hard directional coverage is not true')
  need(coverage.validation?.candidateDistinctness?.distinctBoardIds === EXPECTED_COUNT, 'C1-02 distinct-board coverage drifted')
  need(coverage.validation?.candidateLookupSupport?.requestedBoards === EXPECTED_COUNT, 'C1-02 lookup coverage count drifted')
  need(coverage.candidate?.words?.length === EXPECTED_COUNT, 'C1-02 candidate word coverage is not 100')
  need(coverage.candidate.words.every((row) => row.playerKeyGreen > 0 && row.caseyKeyGreen > 0), 'C1-02 coverage contains a missing key direction')

  const coverageNames = {
    roster: 'roster',
    words: 'words',
    archivalCycle: 'cycle',
    workerAuthoredClues: 'workerAuthoredClues',
    workerPlayerKeys: 'workerPlayerKeys',
    workerLegalClues: 'workerLegalClues',
    workerAssociationIndex: 'workerAssociationIndex',
    workerLcsi: 'workerLcsi',
    clientOpeningClues: 'clientOpeningClues',
    clientPlaytestClues: 'clientPlaytestClues',
  }
  for (const [manifestName, coverageName] of Object.entries(coverageNames)) {
    const manifestPin = manifest.sources[manifestName]
    const coveragePin = coverage.inputHashes?.[coverageName]
    need(coveragePin?.path === manifestPin.path && coveragePin?.sha256 === manifestPin.sha256, `${manifestName} differs from C1-02 evidence`)
  }
  need(sources.clientPlaytestClues.bytes.equals(sources.workerAuthoredClues.bytes), 'client playtest clues differ byte-for-byte from Worker authored clues')
  return { candidate, coverage }
}

function validateBoardData(manifest, loaded, shape, evidence) {
  const source = loaded.sources
  const rosterIds = source.roster.json.wordIds
  need(source.roster.json.schemaVersion === 1 && Array.isArray(rosterIds), 'roster schema is invalid')
  need(rosterIds.length === EXPECTED_COUNT && new Set(rosterIds).size === EXPECTED_COUNT, 'roster is not 100 unique IDs')

  const cycleDocument = source.cycle.json
  const cycle = cycleDocument.boards
  need(cycleDocument.schemaVersion === 1 && Array.isArray(cycle), 'archival cycle schema is invalid')
  need(cycle.length === EXPECTED_ARCHIVE_COUNT, `archival cycle is not ${EXPECTED_ARCHIVE_COUNT} boards`)
  need(manifest.sources.archivalCycle.boardCount === EXPECTED_ARCHIVE_COUNT, 'archival cycle board-count pin drifted')
  need(cycleDocument.sourceSha256 === manifest.sources.archivalCycle.sourceSha256, 'archival cycle source hash drifted')
  need(new Set(cycle.map((board) => board.id)).size === cycle.length, 'archival cycle repeats a board ID')
  const cycleById = new Map(cycle.map((board) => [board.id, board]))
  for (const id of shape.memberIds) need(cycleById.has(id), `required board ${id} is absent from the archival cycle`)

  need(exactArray(shape.memberIds, evidence.candidate.boardIds), 'required membership/order differs from the approved C1-02 candidate')
  need(exactArray(manifest.displayOrder, evidence.candidate.boardIds), 'display order differs from the approved C1-02 candidate order')

  const selected = shape.memberIds.map((id) => cycleById.get(id))
  for (const wordId of rosterIds) {
    need(selected.some((board) => board.playerGreenIds.includes(wordId)), `required set lacks player-key coverage for ${wordId}`)
    need(selected.some((board) => board.aiGreenIds.includes(wordId)), `required set lacks Casey-key coverage for ${wordId}`)
  }

  const authored = new Map(source.workerAuthoredClues.json.boards.map((board) => [board.id, board]))
  const playerKeys = new Map(source.workerPlayerKeys.json.boards.map((board) => [board.id, board]))
  const legal = new Map(source.workerLegalClues.json.boards.map((board) => [board.board, board]))
  const opening = new Map(source.clientOpeningClues.json.boards.map((board) => [board.id, board]))
  need(authored.size === EXPECTED_ARCHIVE_COUNT, 'Worker authored-clue archive is not 150 boards')
  need(playerKeys.size === EXPECTED_ARCHIVE_COUNT, 'Worker player-key archive is not 150 boards')
  need(legal.size === EXPECTED_ARCHIVE_COUNT, 'Worker legal-clue archive is not 150 boards')
  need(opening.size === EXPECTED_ARCHIVE_COUNT, 'client opening-clue archive is not 150 boards')

  need(exactArray(source.workerAssociationIndex.json.wordIds, rosterIds), 'association index roster/order differs')
  need(exactArray(source.workerLcsi.json.wordIds, rosterIds), 'LCSI roster/order differs')
  const association = new Map(
    source.workerAssociationIndex.json.clues.map(([clue, indexes]) => [normalizedClue(clue), new Set(indexes.map((index) => rosterIds[index]))]),
  )
  const lcsi = new Map(
    source.workerLcsi.json.clues.map(([clue, rows]) => [normalizedClue(clue), new Set(rows.map(([index]) => rosterIds[index]))]),
  )

  let authoredTargets = 0
  for (const board of selected) {
    const workerAuthored = authored.get(board.id)
    const workerPlayer = playerKeys.get(board.id)
    const workerLegal = legal.get(board.id)
    const clientOpening = opening.get(board.id)
    need(workerAuthored && exactArray(workerAuthored.wordIds, board.wordIds) && exactArray(workerAuthored.aiGreenIds, board.aiGreenIds), `${board.id} Worker authored identity differs`)
    need(workerPlayer && exactArray(workerPlayer.wordIds, board.wordIds) && exactArray(workerPlayer.playerGreenIds, board.playerGreenIds), `${board.id} Worker player-key identity differs`)
    need(workerLegal?.wordKey === [...board.wordIds].sort().join('|'), `${board.id} Worker legal-clue identity differs`)
    need(
      clientOpening && workerAuthored.caseyClueGroups.some(
        (group) => group.clue === clientOpening.clue && exactArray(group.targetWordIds, clientOpening.targetWordIds),
      ),
      `${board.id} client opening clue is not backed by the Worker authored identity`,
    )
    for (const group of workerAuthored.caseyClueGroups) {
      const clue = normalizedClue(group.clue)
      for (const wordId of group.targetWordIds) {
        authoredTargets++
        need(association.get(clue)?.has(wordId), `${board.id} authored target ${group.clue} -> ${wordId} is absent from association index`)
        need(lcsi.get(clue)?.has(wordId), `${board.id} authored target ${group.clue} -> ${wordId} is absent from LCSI`)
      }
    }
  }
  need(authoredTargets === evidence.coverage.validation.candidateLookupSupport.authoredGroupTargets, 'selected authored-target count differs from C1-02 evidence')

  return {
    rosterCoverage: { player: EXPECTED_COUNT, casey: EXPECTED_COUNT },
    workerClientIdentities: selected.length,
    authoredTargets,
    archivalBoards: cycle.length,
  }
}

function validateProduction(manifest) {
  const shape = validateManifestShape(manifest)
  const loaded = loadProduction(manifest)
  const evidence = validateEvidencePins(manifest, loaded)
  const result = validateBoardData(manifest, loaded, shape, evidence)
  return { loaded, evidence, result }
}

function expectRejected(results, fixture, expected, action) {
  try {
    action()
    fail(`${fixture} fixture was incorrectly accepted`)
  } catch (error) {
    const reason = String(error?.message ?? error)
    need(reason.includes(expected), `${fixture} rejected for the wrong reason: ${reason}`)
    results.push({ fixture, rejected: true, reason })
  }
}

function runSelfTest(manifest, production) {
  const results = []

  const empty = structuredClone(manifest)
  empty.requiredBoardCount = 0
  empty.requiredBoards = []
  empty.displayOrder = []
  expectRejected(results, 'empty-manifest', 'required-board count must be 100', () => validateManifestShape(empty))

  const duplicate = structuredClone(manifest)
  duplicate.requiredBoards[1] = structuredClone(duplicate.requiredBoards[0])
  expectRejected(results, 'duplicate-id', 'requiredBoards repeats bank_001', () => validateManifestShape(duplicate))

  const unknown = structuredClone(manifest)
  unknown.requiredBoards[0].authoredBoardId = 'bank_999'
  unknown.displayOrder[0] = 'bank_999'
  expectRejected(results, 'unknown-id', 'absent from the archival cycle', () => {
    const shape = validateManifestShape(unknown)
    validateBoardData(unknown, production.loaded, shape, production.evidence)
  })

  const revisionless = structuredClone(manifest)
  revisionless.requiredBoards[0].contentRevision = ''
  expectRejected(results, 'empty-content-revision', 'contentRevision must be a nonempty string', () => validateManifestShape(revisionless))

  const candidateDrift = structuredClone(production.evidence)
  candidateDrift.candidate.boardIds[0] = 'bank_999'
  expectRejected(results, 'candidate-membership-drift', 'differs from the approved C1-02 candidate', () => {
    const shape = validateManifestShape(manifest)
    validateBoardData(manifest, production.loaded, shape, candidateDrift)
  })

  const missingDirectionLoaded = structuredClone(production.loaded)
  const selectedIds = new Set(manifest.displayOrder)
  const wordId = missingDirectionLoaded.sources.roster.json.wordIds[0]
  for (const board of missingDirectionLoaded.sources.cycle.json.boards) {
    if (selectedIds.has(board.id)) board.playerGreenIds = board.playerGreenIds.filter((id) => id !== wordId)
  }
  expectRejected(results, 'missing-player-direction', `lacks player-key coverage for ${wordId}`, () => {
    const shape = validateManifestShape(manifest)
    validateBoardData(manifest, missingDirectionLoaded, shape, production.evidence)
  })

  const workerMismatchLoaded = structuredClone(production.loaded)
  const workerBoard = workerMismatchLoaded.sources.workerPlayerKeys.json.boards.find((board) => board.id === manifest.displayOrder[0])
  workerBoard.playerGreenIds = workerBoard.playerGreenIds.slice(1)
  expectRejected(results, 'worker-player-key-mismatch', 'Worker player-key identity differs', () => {
    const shape = validateManifestShape(manifest)
    validateBoardData(manifest, workerMismatchLoaded, shape, production.evidence)
  })

  return results
}

const args = new Set(process.argv.slice(2))
for (const arg of args) need(arg === '--check' || arg === '--self-test', `unknown argument: ${arg}`)
const manifestArtifact = readJson(MANIFEST_PATH)
const production = validateProduction(manifestArtifact.json)

if (args.has('--self-test')) {
  process.stdout.write(`${JSON.stringify({ status: 'PASS', selfTestFixtures: runSelfTest(manifestArtifact.json, production) }, null, 2)}\n`)
} else {
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    manifest: MANIFEST_PATH,
    manifestSha256: manifestArtifact.sha256,
    boardSetVersion: manifestArtifact.json.boardSetVersion,
    requiredBoards: manifestArtifact.json.requiredBoardCount,
    archivalBoards: production.result.archivalBoards,
    rosterCoverage: production.result.rosterCoverage,
    workerClientIdentities: production.result.workerClientIdentities,
    authoredTargetsInBothIndexes: production.result.authoredTargets,
    approvedEvidence: Object.fromEntries(
      Object.entries(manifestArtifact.json.approvedEvidence).map(([name, pin]) => [name, pin.sha256]),
    ),
  }, null, 2)}\n`)
}
