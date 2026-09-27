import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALLOWLIST, scanFile } from './literal-scan.mjs'

/**
 * GATE 2: no new English is written into a component, and the English still
 * there only ever goes down.
 *
 *   node scripts/validate-literals.mjs           check (npm run validate:literals)
 *   node scripts/validate-literals.mjs --write   rewrite the inventory
 *   node scripts/validate-literals.mjs --list    print what is left, worst first
 *
 * ── WHY A RATCHET AND NOT A BAN ────────────────────────────────────────────
 *
 * A ban would have to land in one commit across sixty files, which is a diff
 * nobody can review and a merge nobody can rebase. The inventory lets Phase 1
 * of docs/ui-language-plan.md arrive in six reviewable PRs while making the
 * half-finished state safe: at every commit in between, a file may hold
 * exactly as much English as the inventory says and not one line more. Adding
 * a literal fails. Removing one fails too, until the inventory is lowered in
 * the same commit — which is what makes "we translated this screen" a fact in
 * the repository rather than a claim in a PR body.
 *
 * Phase 1 is done when the inventory is `{}`.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INVENTORY = join(ROOT, 'src/i18n/literal-inventory.json')

/**
 * Where a player-facing string can live.
 *
 * `src/lang/**` is deliberately absent: the Danish pack's English teaching
 * copy is real copy, but it is translated through sidecars in Phase 2 rather
 * than moved, so counting it here would demand a change that must not happen.
 * `src/data/**` is the words themselves, which is Phase 3.
 */
const DIRECTORIES = ['src/ui', 'src/onboarding', 'src/reminders', 'src/purchase']

/**
 * Player copy that does NOT live under a watched directory.
 *
 * Phase 1h. Most of `src/engine`, `src/journey`, `src/stores` and `src/ai` is
 * developer text — invariant errors, model prompts, control flow — so watching
 * those directories whole would add a hundred entries that can never reach
 * zero and drown the signal. These seven files were read one by one and each
 * holds something a player actually reads. Anything similar found later joins
 * this list the same way: by reading it, not by widening a glob.
 */
const FILES = [
  'src/App.tsx',
  'src/ai/client.ts',
  'src/ai/providers.ts',
  'src/backup/backup.ts',
  'src/journey/trainService.ts',
  'src/stores/gameStore.ts',
]

/**
 * Two files this list deliberately does NOT contain, though both hold English
 * a reader might take for copy.
 *
 * `src/engine/legality.ts` still writes its refusals out in English, but they
 * are no longer what a player reads: it returns `why` as data beside them and
 * the clue dock renders THAT from the catalogue, because the game rules have
 * no business knowing what language the chrome speaks. The English `reason` is
 * for the engine's own tests and logs. Watching the file would mean a counter
 * that can never reach zero; the rule that nothing there is rendered is
 * written on `LegalityReason` instead, where someone about to break it will
 * read it.
 *
 * `src/ai/local/engineCompanion.ts` composes Casey's rationale on the LOCAL
 * engine path, which is explicitly gated research and not normal play
 * (WORKING.md). Nothing outside `src/ai/local/` imports it. When it becomes a
 * companion a player can actually reach, it joins the list above.
 */

const SKIP = /\.test\.tsx?$|__probe__|__fuzz__|__scratch__|probe_tmp/

function walk(directory) {
  const out = []
  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) out.push(...walk(path))
    else if (/\.tsx?$/.test(entry.name) && !SKIP.test(path)) out.push(path)
  }
  return out
}

/** Every file gate 2 watches, repo-relative, sorted. */
export function scannedFiles() {
  return [...DIRECTORIES.flatMap(walk), ...FILES].sort()
}

/** @returns {Map<string, import('./literal-scan.mjs').RawLiteral[]>} */
export function scanAll() {
  const result = new Map()
  for (const file of scannedFiles()) {
    result.set(file, scanFile(file, readFileSync(join(ROOT, file), 'utf8'), ALLOWLIST))
  }
  return result
}

const args = process.argv.slice(2)
const write = args.includes('--write')
const list = args.includes('--list')

const scanned = scanAll()
const total = [...scanned.values()].reduce((sum, found) => sum + found.length, 0)

if (write) {
  const next = {}
  for (const file of [...scanned.keys()].sort()) {
    const count = scanned.get(file).length
    if (count > 0) next[file] = count
  }
  writeFileSync(INVENTORY, `${JSON.stringify(next, null, 2)}\n`)
  console.log(
    `Literal inventory rewritten: ${Object.keys(next).length} files, ${total} player-facing literals.`,
  )
  process.exit(0)
}

if (list) {
  for (const [file, found] of [...scanned.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (found.length === 0) continue
    console.log(`\n${file} (${found.length})`)
    for (const l of found) console.log(`  ${String(l.line).padStart(4)} [${l.kind}] ${l.text}`)
  }
  process.exit(0)
}

const inventory = JSON.parse(readFileSync(INVENTORY, 'utf8'))
const problems = []

for (const [file, found] of scanned) {
  const allowed = inventory[file] ?? 0
  if (found.length > allowed) {
    // WHICH ones are new is not knowable from a count, so this lists the
    // file's literals rather than pretending the last few are the culprits.
    const shown = found.slice(0, 20).map((l) => `      ${l.line} [${l.kind}] ${l.text}`)
    if (found.length > 20) shown.push(`      … and ${found.length - 20} more`)
    problems.push(
      `${file}: ${found.length} player-facing literals, ${allowed} allowed — ` +
        `${found.length - allowed} new.\n` +
        `    A string a player reads goes into src/i18n and ships in all four languages in\n` +
        `    the same change — see docs/ui-language-plan.md §5.4. This file holds:\n` +
        shown.join('\n'),
    )
  } else if (found.length < allowed) {
    problems.push(
      `${file}: down to ${found.length} from ${allowed}. Lower its entry in the same commit:\n` +
        `    node scripts/validate-literals.mjs --write`,
    )
  }
}

for (const file of Object.keys(inventory)) {
  if (!scanned.has(file)) {
    problems.push(`${file}: in the inventory but not scanned — renamed or deleted? Rerun --write.`)
  }
}

if (problems.length > 0) {
  console.error('Literal inventory FAILED\n')
  for (const problem of problems) console.error(`  ${problem}\n`)
  process.exit(1)
}

const files = Object.keys(inventory).length
console.log(
  files === 0
    ? 'Literals OK: no player-facing English left outside src/i18n. Phase 1 is complete.'
    : `Literals OK: ${total} player-facing literals in ${files} files, none added. ` +
        'Each one still has to move into src/i18n before Phase 1 is done.',
)
