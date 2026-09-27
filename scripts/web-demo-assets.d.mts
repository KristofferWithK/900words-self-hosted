import type { Plugin } from 'vite'

/** Every public/ file the web demo ships, as posix paths relative to public/. */
export function webDemoAssetList(): string[]

/** Vite plugin: copy the allowlisted slice of public/ into the demo's outDir. */
export function webDemoAssets(): Plugin
