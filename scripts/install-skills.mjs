#!/usr/bin/env node
/**
 * Install the repository's canonical skills into this checkout's Claude Code
 * skills directory.
 *
 *   node scripts/install-skills.mjs           copy skills/* -> .claude/skills/*
 *   node scripts/install-skills.mjs --check   report differences, change nothing, exit 1 if any
 *
 * `skills/<name>/SKILL.md` is the one canonical copy. Every harness reads a
 * copy of it, never its own edited version:
 *
 *   Claude Code   .claude/skills/<name>/SKILL.md      this script
 *   Hermes        $HERMES_HOME/skills/<name>/SKILL.md  scp, see below
 *   Codex         a pointer in AGENTS.md               nothing to copy
 *
 * The Hermes copy is a manual step because it crosses a machine boundary and
 * needs the owner's SSH access:
 *
 *   scp -r skills/<name> maquette-vps:/opt/pagi-hermes-team/state/developer/onboarding/skills/
 *
 * Idempotent: a file whose bytes already match is left alone and reported as
 * unchanged. Nothing under .claude/skills/ is ever deleted by this script, so
 * a skill removed from skills/ has to be removed there by hand; the run says
 * so when it finds one.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, relative, sep } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = resolve(root, 'skills')
const target = resolve(root, '.claude', 'skills')
const check = process.argv.includes('--check')
const slash = (value) => value.split(sep).join('/')

if (!existsSync(source)) {
  console.error(`No skills directory at ${slash(relative(root, source))}`)
  process.exit(1)
}

/** Every file under dir, as paths relative to dir. */
function files(dir, prefix = '') {
  const out = []
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue
    const path = resolve(dir, item.name)
    if (item.isDirectory()) out.push(...files(path, `${prefix}${item.name}/`))
    else if (item.isFile()) out.push(`${prefix}${item.name}`)
  }
  return out
}

const names = readdirSync(source, { withFileTypes: true })
  .filter((item) => item.isDirectory() && !item.name.startsWith('.'))
  .map((item) => item.name)
  .sort()

const added = []
const updated = []
const unchanged = []
for (const name of names) {
  const skillDir = resolve(source, name)
  if (!existsSync(resolve(skillDir, 'SKILL.md'))) {
    console.error(`${slash(relative(root, skillDir))}: a skill directory must contain SKILL.md`)
    process.exit(1)
  }
  for (const file of files(skillDir)) {
    const from = resolve(skillDir, file)
    const to = resolve(target, name, file)
    const bytes = readFileSync(from)
    const label = `${name}/${file}`
    if (existsSync(to) && readFileSync(to).equals(bytes)) {
      unchanged.push(label)
      continue
    }
    const list = existsSync(to) ? updated : added
    list.push(label)
    if (!check) {
      mkdirSync(resolve(target, name, ...file.split('/').slice(0, -1)), { recursive: true })
      writeFileSync(to, bytes)
    }
  }
}

const orphans = existsSync(target)
  ? readdirSync(target, { withFileTypes: true })
      .filter((item) => item.isDirectory() && !names.includes(item.name))
      .map((item) => item.name)
  : []

const verb = check ? 'would be' : 'were'
for (const label of added) console.log(`added     ${label}`)
for (const label of updated) console.log(`updated   ${label}`)
console.log(`${names.length} skills; ${added.length} ${verb} added, ${updated.length} ${verb} updated, ${unchanged.length} already identical.`)
console.log(`Target: ${slash(relative(root, target))}`)
for (const name of orphans) console.log(`orphan    .claude/skills/${name} has no source in skills/; remove it by hand if the skill was retired`)
console.log('Hermes copy (manual, crosses a machine boundary):')
console.log('  scp -r skills/<name> maquette-vps:/opt/pagi-hermes-team/state/developer/onboarding/skills/')

if (check && (added.length || updated.length)) {
  console.error('Skills in .claude/skills/ differ from skills/. Run: node scripts/install-skills.mjs')
  process.exit(1)
}
