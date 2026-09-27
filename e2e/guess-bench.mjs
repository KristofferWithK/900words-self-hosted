// Guesser benchmark: which affordable model guesses best under the PLAYER's
// clues on the 150 authored City 1 boards, measured through the shipped
// Worker bundle and nothing else.
//
// Opt-in (scripts/run-drives.mjs OPT_IN): every row is a real model call on
// the local Ollama daemon, which proxies `<model>:cloud` tags to ollama.com
// through its own sign-in. The Worker is wrangler's own bundle on miniflare
// (e2e/worker-runtime.mjs), so the prompt, the firewall, the validator, the
// corrections and the index fallback are exactly what the phone gets; the
// harness only chooses the model through MODEL_ALIASES and reads the ledger
// arm back. It never measures a model by talking to it directly.
//
//   node e2e/guess-bench.mjs --model gpt-oss:120b-cloud --smoke
//   node e2e/guess-bench.mjs --model <tag> --tier t1 --mode pure,boardid --concurrency 4
//   node e2e/guess-bench.mjs --report
//
// The test set. `t1` is the bank's curated player clue groups — three per
// board, 450 in all — each with the greens it was composed to reach; the
// clue's number is that group's size. `t2` is every player group in the
// bank's graph (9,372). A row is one (board, group, mode).
//
// The two modes. `pure` sends the view WITHOUT `boardId`, so nothing on the
// guess side can answer from the board's own key: that is the headline
// number. `boardid` sends it, which lets authored-player-clues.js answer a
// made-for clue with certainty and no model (arm `authored`); it is here to
// measure that shortcut's share of the bank, and its rows are excluded from
// the model's accuracy.
//
// The score replicates the game: planGuessExecution (src/ai/companion.ts —
// confidence desc, cap at the number, stop under 0.35 after the first, always
// at least one) and then the guess rule of src/engine/game.ts — under the
// player's clue every guess is judged against the PLAYER's key and the turn
// ends at the first card that is not green there. A card green on Casey's
// key and not the player's is a bystander to this walk; it is counted
// separately as a wrong-team hit because it is the failure a guesser that
// knows the words but not the keys makes.
//
// Every reply is cached as one JSONL line keyed model|boardId|mode|clue, so a
// rerun skips what it has and a killed run resumes. Only a 200 is a cached
// answer: a 429 (`upstream_rate_limit`), a 5xx, a timeout or a dropped
// connection is retried on the next run and never scored as a miss.

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { startWorker } from './worker-runtime.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BANK_PATH = join(ROOT, 'docs', 'research', 'board-engine', 'city1-bank', 'bank.city1.v2.ordered.json')
const OPUS_PATH = join(ROOT, 'docs', 'research', 'board-engine', 'city1-bank', 'bank.city1.v2.guesser-opus-gloss.json')
const KEYS_PATH = join(ROOT, 'proxy', 'data', 'authored-player-keys.da.1.json')
const WORDS_PATH = join(ROOT, 'src', 'data', 'words.da.json')
const OUT_DIR = join(ROOT, 'docs', 'research', 'guess-bench')

const UPSTREAM = process.env.GUESS_BENCH_UPSTREAM ?? 'http://127.0.0.1:11434'
const PORT = 4320 + Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const CASEY_PROTOCOL = 1
const REQUEST_TIMEOUT_MS = 240_000
const RATE_LIMIT_RETRIES = 3
// planGuessExecution's threshold (src/ai/companion.ts). Replicated, not
// imported: src/ is TypeScript and the bench must not need a build.
const STOP_BELOW = 0.35

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const args = {
    model: null,
    tier: 't1',
    modes: ['pure', 'boardid'],
    concurrency: 4,
    smoke: false,
    report: false,
    label: null,
    limit: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--model') args.model = next()
    else if (a === '--tier') args.tier = next()
    else if (a === '--mode') args.modes = next().split(',').map((m) => m.trim()).filter(Boolean)
    else if (a === '--concurrency') args.concurrency = Number(next())
    else if (a === '--smoke') args.smoke = true
    else if (a === '--report') args.report = true
    else if (a === '--label') args.label = next()
    else if (a === '--limit') args.limit = Number(next())
    else throw new Error(`unknown argument ${a}`)
  }
  if (args.tier !== 't1' && args.tier !== 't2') throw new Error('--tier must be t1 or t2')
  for (const m of args.modes) if (m !== 'pure' && m !== 'boardid') throw new Error(`unknown mode ${m}`)
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1) throw new Error('--concurrency must be a positive integer')
  return args
}

/** A file-safe, ledger-safe name for a model tag: `qwen3.5:397b-cloud` → `qwen3-5_397b-cloud`. */
const safeName = (tag) => tag.replace(/:/g, '_').replace(/[^A-Za-z0-9_-]/g, '-')
const cachePathFor = (tag) => join(OUT_DIR, `replies.${safeName(tag)}.jsonl`)

// --------------------------------------------------------------------- data

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

function loadBank() {
  const bank = readJson(BANK_PATH)
  const keys = readJson(KEYS_PATH)
  const words = new Map(readJson(WORDS_PATH).map((w) => [w.id, w]))
  if (keys.boards.length !== bank.boards.length) {
    throw new Error(`the bank has ${bank.boards.length} boards and the player-key file ${keys.boards.length}`)
  }
  const boards = bank.boards.map((board, i) => {
    // Board i of the ordered bank is authored board bank_NNN, 1-based, three
    // digits. Verified against the Worker's own key file rather than assumed.
    const boardId = `bank_${String(i + 1).padStart(3, '0')}`
    const key = keys.boards[i]
    if (key.id !== boardId) throw new Error(`board ${i} is ${key.id} in the key file, expected ${boardId}`)
    if (key.wordIds.join(',') !== board.cells.join(',')) throw new Error(`${boardId}: the bank's cells differ from the key file`)
    if ([...key.playerGreenIds].sort().join(',') !== [...board.player].sort().join(',')) {
      throw new Error(`${boardId}: the bank's player key differs from the key file`)
    }
    for (const id of board.cells) if (!words.has(id)) throw new Error(`${boardId}: ${id} is not in words.da.json`)
    return {
      index: i,
      boardId,
      seed: board.seed,
      cells: board.cells,
      player: new Set(board.player),
      casey: new Set(board.casey),
      daToId: new Map(board.cells.map((id) => [words.get(id).da, id])),
      groups: board.groups,
      graphPlayer: board.graph.player,
    }
  })
  return { boards, words }
}

/** The (board, clue, number, targets) rows of a tier. */
function testSet(boards, tier) {
  const rows = []
  for (const board of boards) {
    const groups = tier === 't1' ? board.groups.filter((g) => g.side === 'player') : board.graphPlayer
    for (const group of groups) {
      const number = group.ids.length
      // The view accepts 1–4; the curated groups are 2 or 3, the graph never
      // exceeds 4 today. A larger group would be a data change, so say so.
      if (number < 1 || number > 4) throw new Error(`${board.boardId}: group «${group.clue}» has ${number} targets`)
      rows.push({ board, clue: group.clue, number, targets: group.ids })
    }
  }
  return rows
}

function guessView(board, words, clue, number, withBoardId) {
  return {
    kind: 'ai-guess',
    clueLanguage: 'target',
    turnsLeft: 8,
    words: board.cells.map((id) => {
      const w = words.get(id)
      return { id, da: w.da, en: w.en.slice(0, 6), pos: w.pos, reveal: { kind: 'hidden' } }
    }),
    currentClue: { text: clue, number },
    history: [],
    flagged: [],
    ...(withBoardId ? { boardId: board.boardId } : {}),
  }
}

// -------------------------------------------------------------------- cache

const rowKey = (model, boardId, mode, clue) => `${model}|${boardId}|${mode}|${clue}`

function readCache(path) {
  const rows = new Map()
  if (!existsSync(path)) return rows
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    let row
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    // Later lines win: a retried row overwrites its failed predecessor.
    rows.set(row.key, row)
  }
  return rows
}

const isAnswered = (row) => row && row.status === 200

// ------------------------------------------------------------------ scoring

/** src/ai/companion.ts planGuessExecution, replicated. */
export function planGuessExecution(guesses, clueNumber) {
  const ordered = [...guesses].sort((a, b) => b.confidence - a.confidence)
  const plan = []
  for (const guess of ordered) {
    if (plan.length >= clueNumber) break
    if (plan.length >= 1 && guess.confidence < STOP_BELOW) break
    plan.push(guess)
  }
  if (plan.length === 0 && ordered.length > 0) plan.push(ordered[0])
  return plan
}

/**
 * Walk a plan the way the engine would under the player's clue: judged
 * against the player's key, the turn ends at the first non-green.
 */
export function walk(plan, board) {
  let hits = 0
  let wrongTeam = 0
  let firstGreen = false
  for (let i = 0; i < plan.length; i++) {
    const id = plan[i].wordId
    const green = board.player.has(id)
    if (i === 0) firstGreen = green
    if (green) {
      hits++
      continue
    }
    if (board.casey.has(id)) wrongTeam++
    break
  }
  return { hits, wrongTeam, firstGreen }
}

function topNAccuracy(guesses, number, board) {
  const top = [...guesses].sort((a, b) => b.confidence - a.confidence).slice(0, number)
  if (top.length === 0) return 0
  return top.filter((g) => board.player.has(g.wordId)).length / number
}

const percentile = (values, p) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

function emptyStats() {
  return {
    rows: 0,
    answered: 0,
    pending: 0,
    authored: 0,
    fallback: 0,
    refused: 0,
    scored: 0,
    asked: 0,
    hits: 0,
    firstGreen: 0,
    topN: [],
    bystanderFirst: 0,
    wrongTeam: 0,
    firstConfidence: [],
    latency: [],
    effectiveAsked: 0,
    effectiveHits: 0,
  }
}

function finish(s) {
  const pct = (n, d) => (d ? n / d : null)
  return {
    rows: s.rows,
    answered: s.answered,
    pending: s.pending,
    scored: s.scored,
    hitsPerAsked: pct(s.hits, s.asked),
    hits: s.hits,
    asked: s.asked,
    firstGuessAccuracy: pct(s.firstGreen, s.scored),
    topNAccuracy: mean(s.topN),
    bystanderFirstRate: pct(s.bystanderFirst, s.scored),
    wrongTeamHitsPerRow: pct(s.wrongTeam, s.scored),
    meanFirstConfidence: mean(s.firstConfidence),
    refusedRate: pct(s.refused, s.answered - s.authored),
    fallbackIndexRate: pct(s.fallback, s.answered - s.authored),
    authoredShare: pct(s.authored, s.answered),
    effectiveHitsPerAsked: pct(s.effectiveHits, s.effectiveAsked),
    p50LatencyMs: percentile(s.latency, 0.5),
    p95LatencyMs: percentile(s.latency, 0.95),
  }
}

/** Score one model's cache against the boards. */
function scoreCache(rows, boards, tier) {
  const byId = new Map(boards.map((b) => [b.boardId, b]))
  const perMode = {}
  const labels = new Set()
  for (const row of rows.values()) {
    if (row.tier !== tier) continue
    const board = byId.get(row.boardId)
    if (!board) continue
    const s = (perMode[row.mode] ??= emptyStats())
    s.rows++
    if (!isAnswered(row)) {
      s.pending++
      continue
    }
    s.answered++
    if (row.label) labels.add(row.label)
    const arm = row.arm ?? ''
    const authored = arm === 'authored'
    const fallback = arm.includes('+fallback-')
    if (authored) s.authored++
    else {
      s.latency.push(row.latency)
      if (fallback) s.fallback++
      if (row.refused) s.refused++
    }
    const plan = planGuessExecution(row.guesses ?? [], row.number)
    const walked = walk(plan, board)
    // What the game would actually deliver in this mode, shortcut included.
    s.effectiveAsked += row.number
    s.effectiveHits += walked.hits
    if (authored || fallback) continue
    s.scored++
    s.asked += row.number
    s.hits += walked.hits
    if (walked.firstGreen) s.firstGreen++
    else s.bystanderFirst++
    s.wrongTeam += walked.wrongTeam
    s.topN.push(topNAccuracy(row.guesses ?? [], row.number, board))
    if (plan[0]) s.firstConfidence.push(plan[0].confidence)
  }
  return {
    labels: [...labels],
    modes: Object.fromEntries(Object.entries(perMode).map(([mode, s]) => [mode, finish(s)])),
  }
}

/**
 * The Opus reference: the bank's cached Opus rankings (gates.mjs), keyed
 * seed|sha8(cells)|clue, mostly Casey-side. Where a t1 clue has one, its
 * top-number is walked the same way; it carries no confidences, so the plan
 * is the top-number itself. Coverage is reported beside the row.
 */
function scoreOpus(boards, tier) {
  if (!existsSync(OPUS_PATH)) return null
  const opus = readJson(OPUS_PATH)
  const boardKey = (b) => `${b.seed}|${createHash('sha256').update(b.cells.join(',')).digest('hex').slice(0, 8)}`
  const set = testSet(boards, tier)
  const s = emptyStats()
  let unmapped = 0
  for (const row of set) {
    s.rows++
    const entry = opus[`${boardKey(row.board)}|${row.clue}`]
    if (!entry || !Array.isArray(entry.ranking)) {
      s.pending++
      continue
    }
    s.answered++
    const guesses = []
    for (const da of entry.ranking) {
      const id = row.board.daToId.get(da)
      if (!id) {
        unmapped++
        continue
      }
      guesses.push({ wordId: id, confidence: 1 - guesses.length / 100 })
    }
    const plan = guesses.slice(0, row.number)
    const walked = walk(plan, row.board)
    s.scored++
    s.asked += row.number
    s.hits += walked.hits
    s.effectiveAsked += row.number
    s.effectiveHits += walked.hits
    if (walked.firstGreen) s.firstGreen++
    else s.bystanderFirst++
    s.wrongTeam += walked.wrongTeam
    s.topN.push(topNAccuracy(guesses, row.number, row.board))
  }
  const finished = finish(s)
  return { coverage: { covered: s.answered, of: set.length }, unmappedRankingEntries: unmapped, modes: { pure: finished } }
}

// ------------------------------------------------------------------- report

const fmtPct = (v) => (v === null || v === undefined ? '–' : `${(v * 100).toFixed(1)}%`)
const fmtNum = (v, d = 2) => (v === null || v === undefined ? '–' : v.toFixed(d))
const fmtMs = (v) => (v === null || v === undefined ? '–' : `${(v / 1000).toFixed(1)} s`)

function writeReport(boards, tier) {
  const files = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => /^replies\..+\.jsonl$/.test(f)) : []
  const models = {}
  for (const file of files) {
    const rows = readCache(join(OUT_DIR, file))
    if (rows.size === 0) continue
    const tags = new Set([...rows.values()].map((r) => r.model))
    for (const tag of tags) {
      const own = new Map([...rows].filter(([, r]) => r.model === tag))
      models[tag] = { file, ...scoreCache(own, boards, tier) }
    }
  }
  const opus = scoreOpus(boards, tier)
  const results = { generatedAt: new Date().toISOString(), tier, boards: boards.length, models, opus }
  writeFileSync(join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2) + '\n')

  const header = [
    'model',
    'pure rows',
    'hits/asked (pure)',
    'first-guess acc',
    'top-N acc',
    'bystander-first',
    'wrong-team/row',
    'mean 1st conf',
    'refused',
    'fallback-index',
    'p50 / p95',
    'boardid rows',
    'authored share',
    'hits/asked (boardid, authored incl.)',
  ]
  const line = (name, pure, boardid, extra = '') => {
    const p = pure ?? {}
    const b = boardid ?? {}
    return [
      name + extra,
      p.rows === undefined ? '–' : `${p.scored ?? 0}/${p.rows}${p.pending ? ` (${p.pending} pending)` : ''}`,
      fmtPct(p.hitsPerAsked),
      fmtPct(p.firstGuessAccuracy),
      fmtPct(p.topNAccuracy),
      fmtPct(p.bystanderFirstRate),
      fmtNum(p.wrongTeamHitsPerRow),
      fmtNum(p.meanFirstConfidence),
      fmtPct(p.refusedRate),
      fmtPct(p.fallbackIndexRate),
      p.p50LatencyMs == null ? '–' : `${fmtMs(p.p50LatencyMs)} / ${fmtMs(p.p95LatencyMs)}`,
      b.rows === undefined ? '–' : `${b.answered ?? 0}/${b.rows}${b.pending ? ` (${b.pending} pending)` : ''}`,
      fmtPct(b.authoredShare),
      fmtPct(b.effectiveHitsPerAsked),
    ]
  }
  const rows = Object.entries(models)
    .sort(([, a], [, b]) => (b.modes.pure?.hitsPerAsked ?? -1) - (a.modes.pure?.hitsPerAsked ?? -1))
    .map(([tag, m]) => line(`\`${tag}\``, m.modes.pure, m.modes.boardid))
  if (opus) {
    rows.push(
      line(
        'Opus reference (bank rankings)',
        opus.modes.pure,
        null,
        ` — covers ${opus.coverage.covered}/${opus.coverage.of} t1 clues`,
      ),
    )
  }
  const md = [
    `# Guesser benchmark — tier ${tier}`,
    '',
    `Generated ${results.generatedAt} by \`node e2e/guess-bench.mjs --report\` from every \`replies.*.jsonl\` in this directory.`,
    '',
    'Every model row went through the shipped Worker bundle (prompt, firewall, validator, corrections, index fallback) with only `MODEL_ALIASES` changed. A guess is scored the way the game plays it: `planGuessExecution` (confidence desc, cap at the number, stop below 0.35 after the first), then judged against the **player\'s** key with the turn ending at the first non-green. `pure` omits `boardId` and is the headline; `boardid` lets the Worker answer a made-for clue from the key without a model (arm `authored`), and those rows — and `+fallback-index` rows — are excluded from the model columns. `wrong-team/row` counts cards green on Casey\'s key that the walk hit. The Opus row is the bank\'s cached Opus rankings (mostly Casey-side, so its coverage of the player clues is small) walked with the same rule and no confidences.',
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
  ].join('\n')
  writeFileSync(join(OUT_DIR, 'RESULTS.md'), md)
  console.log(md)
  console.log(`written ${join(OUT_DIR, 'results.json')} and RESULTS.md`)
}

// ---------------------------------------------------------------------- run

async function askWorker(base, installId, view) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const started = performance.now()
  try {
    const res = await fetch(`${base}/v1/casey/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Install-Id': installId },
      body: JSON.stringify({ protocol: CASEY_PROTOCOL, operation: 'guess', view }),
      signal: controller.signal,
    })
    const latency = Math.round(performance.now() - started)
    const text = await res.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    return { status: res.status, latency, body, raw: body ? null : text.slice(0, 200) }
  } catch (e) {
    return { status: 0, latency: Math.round(performance.now() - started), body: null, raw: e.name === 'AbortError' ? 'timeout' : String(e.message ?? e) }
  } finally {
    clearTimeout(timer)
  }
}

async function runModel(args, boards, words) {
  const tag = args.model
  const label = (args.label ?? safeName(tag)).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32)
  const installId = `guess-bench-${safeName(tag)}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64)
  const cachePath = cachePathFor(tag)
  mkdirSync(OUT_DIR, { recursive: true })
  const cache = readCache(cachePath)

  let set = testSet(boards, args.tier)
  let modes = args.modes
  if (args.smoke) {
    // Three real calls on three different boards, pure mode only.
    set = [0, 1, 2].map((i) => set.find((r) => r.board.index === i)).filter(Boolean)
    modes = ['pure']
  } else if (args.limit) set = set.slice(0, args.limit)

  const jobs = []
  for (const mode of modes) {
    for (const row of set) {
      const key = rowKey(tag, row.board.boardId, mode, row.clue)
      if (!args.smoke && isAnswered(cache.get(key))) continue
      jobs.push({ key, mode, row })
    }
  }
  const total = set.length * modes.length
  console.log(
    `guess-bench: ${tag} as arm «${label}», tier ${args.tier}, modes ${modes.join(',')} — ${total} rows, ${total - jobs.length} cached, ${jobs.length} to ask at concurrency ${args.concurrency}`,
  )
  if (jobs.length === 0 && !args.smoke) return { ok: true }

  const worker = await startWorker(PORT, {
    upstream: UPSTREAM,
    // The Worker refuses to call upstream without a key; the daemon ignores it.
    apiKey: 'local-daemon',
    vars: {
      CASEY_MODEL: 'cluey',
      CASEY_REPORT_ARM: label,
      MODEL_ALIASES: JSON.stringify({ cluey: { model: tag } }),
    },
  })
  if (!worker) throw new Error('miniflare is not installed; npm ci first')

  const started = Date.now()
  let done = 0
  let answered = 0
  let rateLimited = 0
  const arms = new Map()
  const latencies = []
  const smokeRows = []

  const doJob = async (job) => {
    const view = guessView(job.row.board, words, job.row.clue, job.row.number, job.mode === 'boardid')
    let reply
    for (let attempt = 0; ; attempt++) {
      reply = await askWorker(worker.base, installId, view)
      const code = reply.body?.error?.code
      if ((reply.status === 429 || code === 'upstream_rate_limit') && attempt < RATE_LIMIT_RETRIES) {
        rateLimited++
        await sleep(15_000 * (attempt + 1))
        continue
      }
      break
    }
    const ok = reply.status === 200 && Array.isArray(reply.body?.decision?.guesses)
    const record = {
      key: job.key,
      model: tag,
      label,
      tier: args.tier,
      boardId: job.row.board.boardId,
      mode: job.mode,
      clue: job.row.clue,
      number: job.row.number,
      targets: job.row.targets,
      status: ok ? 200 : reply.status,
      code: ok ? null : (reply.body?.error?.code ?? reply.raw ?? 'unknown'),
      latency: reply.latency,
      arm: ok ? reply.body.report?.arm ?? null : null,
      refused: ok ? Boolean(reply.body.report?.refused) : null,
      guesses: ok ? reply.body.decision.guesses : null,
      at: new Date().toISOString(),
    }
    appendFileSync(cachePath, JSON.stringify(record) + '\n')
    cache.set(job.key, record)
    done++
    if (ok) {
      answered++
      latencies.push(reply.latency)
      arms.set(record.arm, (arms.get(record.arm) ?? 0) + 1)
    }
    if (args.smoke) smokeRows.push(record)
    if (done % 25 === 0 || done === jobs.length) {
      const elapsed = (Date.now() - started) / 1000
      const rate = done / elapsed
      const eta = rate > 0 ? Math.round((jobs.length - done) / rate / 60) : '?'
      console.log(
        `  ${done}/${jobs.length} — ${answered} answered, p50 ${fmtMs(percentile(latencies, 0.5))}, ${elapsed.toFixed(0)} s elapsed, ~${eta} min left, arms ${JSON.stringify(Object.fromEntries(arms))}${rateLimited ? `, ${rateLimited} rate-limit waits` : ''}`,
      )
    }
  }

  let cursor = 0
  const lane = async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      try {
        await doJob(job)
      } catch (e) {
        console.log(`  ${job.key}: harness error — ${e.message ?? e}`)
      }
    }
  }
  await Promise.all(Array.from({ length: args.smoke ? 1 : args.concurrency }, lane))
  await worker.stop()

  if (args.smoke) {
    console.log('')
    let refusedAll = true
    let fallback = false
    for (const r of smokeRows) {
      const board = boards[Number(r.boardId.slice(5)) - 1]
      const plan = r.guesses ? planGuessExecution(r.guesses, r.number) : []
      const walked = r.guesses ? walk(plan, board) : null
      console.log(
        `  ${r.boardId} «${r.clue}» ×${r.number}: status ${r.status}${r.code ? ` (${r.code})` : ''}, ${r.latency} ms, arm ${r.arm}, refused ${r.refused}` +
          (r.guesses
            ? `\n    guesses: ${r.guesses.map((g) => `${g.wordId.replace(/^da:/, '')}@${g.confidence}`).join(', ')}\n    targets: ${r.targets.map((t) => t.replace(/^da:/, '')).join(', ')} → ${walked.hits}/${r.number} in the walk`
            : ''),
      )
      if (r.status === 200 && !r.refused) refusedAll = false
      if (r.arm && r.arm.includes('+fallback-')) fallback = true
    }
    const answeredAny = smokeRows.some((r) => r.status === 200)
    const pass = answeredAny && !refusedAll && !fallback
    console.log(`\nSMOKE ${pass ? 'PASS' : 'FAIL'}: ${tag} — ${answeredAny ? 'answered' : 'no answer'}, ${refusedAll ? 'every reply needed a correction' : 'clean JSON replies'}, ${fallback ? 'FELL BACK to the index' : 'no fallback'}`)
    return { ok: pass }
  }
  const pending = jobs.length - answered
  console.log(`guess-bench: ${tag} done — ${answered} answered this run, ${pending} still pending (rerun the same command to retry)`)
  return { ok: true }
}

// --------------------------------------------------------------------- main

const args = parseArgs(process.argv.slice(2))
const { boards, words } = loadBank()
if (args.report) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeReport(boards, args.tier)
} else {
  if (!args.model) throw new Error('--model <tag> is required (or --report)')
  const result = await runModel(args, boards, words)
  process.exit(result.ok ? 0 : 1)
}
