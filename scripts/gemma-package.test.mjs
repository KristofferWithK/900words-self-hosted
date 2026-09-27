import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = readFileSync('ios-plugins/cluecab-gemma/Package.swift', 'utf8')
const source = readFileSync('ios-plugins/cluecab-gemma/vendor/LiteRTLM/SOURCE.md', 'utf8')

describe('the iOS Gemma runtime package', () => {
  it('pins the official v0.16.0 Apple binary without cloning the broken cross-platform tag', () => {
    expect(manifest).toContain(
      'https://github.com/google-ai-edge/LiteRT-LM/releases/download/v0.16.0/CLiteRTLM.xcframework.zip',
    )
    expect(manifest).toContain('4e0f683da07566ee79c143d2d58d387f77052b0e6a41562c969e5d2728fc9f4b')
    expect(manifest).not.toContain('https://github.com/google-ai-edge/LiteRT-LM.git')
  })

  it('records the exact matching wrapper revision', () => {
    expect(source).toContain('924e79c91542761242244e4f1651851f822e4cbb')
  })
})
