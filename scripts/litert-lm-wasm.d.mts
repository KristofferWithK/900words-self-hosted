import type { Plugin } from 'vite'

/** Vite plugin: serve LiteRT-LM's WebAssembly at <base>litert-lm/wasm/ in dev and copy it into the build. */
export function litertLmWasm(): Plugin
