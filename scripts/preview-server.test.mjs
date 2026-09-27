import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveViteBin } from '../e2e/preview-server.mjs'

describe('preview Vite resolver', () => {
  it('finds the repository-root install and rejects a higher-ancestor decoy', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'preview-server-'))
    try {
      const repo = resolve(root, 'repo')
      const checkout = resolve(repo, 'worktree')
      const vite = resolve(repo, 'node_modules', 'vite', 'bin', 'vite.js')
      mkdirSync(checkout, { recursive: true })
      writeFileSync(resolve(checkout, '.git'), `gitdir: ${resolve(repo, '.git', 'worktrees', 'worktree')}`)
      mkdirSync(dirname(vite), { recursive: true })
      writeFileSync(vite, '')
      const decoy = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js')
      mkdirSync(dirname(decoy), { recursive: true })
      writeFileSync(decoy, '')
      expect(resolveViteBin(checkout)).toBe(vite)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports a missing install', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'preview-server-'))
    try {
      expect(() => resolveViteBin(resolve(root, 'worktree'))).toThrow(/could not find Vite/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
