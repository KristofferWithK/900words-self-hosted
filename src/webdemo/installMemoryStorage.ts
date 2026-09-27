/**
 * The website demo keeps nothing in the visitor's browser (owner, 2026-09-26:
 * "nothing stored; a reload starts over"). Every part of the app that saves
 * state (the settlement journal, the zustand stores, the install id, hints,
 * tips, the onboarding markers) reads the bare `localStorage` / `sessionStorage`
 * globals, so the one seam is to replace those globals, for web-demo builds
 * only, before any of those modules is evaluated. main.tsx imports this file
 * first; ES modules evaluate in import order, so no store rehydrates first.
 *
 * Other audiences: nothing happens. The native app compiles this module and
 * returns on the first line.
 *
 * Fails closed: if the globals cannot be replaced, it throws at module
 * evaluation, which stops the app from loading at all rather than letting it
 * write to the real storage.
 */
import { isWebDemo } from '../build/audience'

export class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>()

  get length(): number {
    return this.items.size
  }

  clear(): void {
    this.items.clear()
  }

  getItem(key: string): string | null {
    return this.items.has(String(key)) ? this.items.get(String(key))! : null
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.items.delete(String(key))
  }

  setItem(key: string, value: string): void {
    this.items.set(String(key), String(value))
  }
}

/** Replace both storage globals on `target`; throws when it did not take. */
export function installMemoryStorage(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (target[name] instanceof MemoryStorage) continue
    const memory = new MemoryStorage()
    Object.defineProperty(target, name, { configurable: true, enumerable: true, get: () => memory })
    if (target[name] !== memory) throw new Error(`the web demo could not keep ${name} in memory`)
  }
}

if (isWebDemo()) {
  try {
    installMemoryStorage()
  } catch (error) {
    // Throwing here aborts the whole module graph: no store below main.tsx's
    // first import is ever evaluated, so nothing reaches the real storage.
    // The page stays empty rather than run against the visitor's storage.
    throw error
  }
}
