import { beforeEach, describe, expect, it, vi } from 'vitest'

const { platform, plugin } = vi.hoisted(() => ({
  platform: { native: false, name: 'web' },
  plugin: { status: vi.fn(), download: vi.fn(), generate: vi.fn(), unloadModel: vi.fn() },
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => platform.name,
  },
}))
vi.mock('cluecab-gemma', () => ({ Gemma: plugin }))

import {
  GEMMA_DOWNLOAD_BYTES,
  OFFLINE_CASEY_ANDROID_EXAMPLES,
  belowOfflineCaseyMemory,
  gemmaPlatform,
  gemmaStatus,
  gemmaSupported,
  startGemmaDownload,
  unloadGemma,
  type GemmaStatus,
} from './native'
import pluginModel from '../../../ios-plugins/cluecab-gemma/android/src/main/java/com/kristofferwithk/cluecabgemma/GemmaModel.kt?raw'
import swiftPlugin from '../../../ios-plugins/cluecab-gemma/ios/Sources/GemmaPlugin/GemmaPlugin.swift?raw'
import pluginPackage from '../../../ios-plugins/cluecab-gemma/package.json'

const on = (native: boolean, name: string) => {
  platform.native = native
  platform.name = name
}

const status = (physicalMemory?: number): GemmaStatus => ({
  supported: true,
  installed: false,
  downloading: false,
  progress: 0,
  expectedBytes: GEMMA_DOWNLOAD_BYTES,
  freeBytes: 10e9,
  physicalMemory,
})

describe('offline Casey on the iPhone and on Android', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    on(false, 'web')
  })

  it('is in both native apps, and nowhere else', () => {
    on(true, 'ios')
    expect(gemmaPlatform()).toBe('ios')
    expect(gemmaSupported()).toBe(true)
    on(true, 'android')
    expect(gemmaPlatform()).toBe('android')
    expect(gemmaSupported()).toBe(true)
    on(false, 'web')
    expect(gemmaPlatform()).toBeNull()
    expect(gemmaSupported()).toBe(false)
  })

  it('leaves whether THIS Android phone can run her to the plugin', async () => {
    on(true, 'android')
    plugin.status.mockResolvedValue({ ...status(5.7e9), supported: false, unsupportedReason: 'memory' })
    await expect(gemmaStatus()).resolves.toMatchObject({ supported: false, unsupportedReason: 'memory' })
    expect(plugin.status).toHaveBeenCalled()
  })

  it('never calls the plugin on the web', async () => {
    await expect(gemmaStatus()).resolves.toMatchObject({ supported: false, installed: false })
    await expect(startGemmaDownload()).rejects.toThrow(/iPhone and Android/)
    await unloadGemma()
    expect(plugin.status).not.toHaveBeenCalled()
    expect(plugin.download).not.toHaveBeenCalled()
    expect(plugin.unloadModel).not.toHaveBeenCalled()
  })

  it('downloads through the plugin on Android', async () => {
    on(true, 'android')
    plugin.download.mockResolvedValue({ started: true })
    await startGemmaDownload()
    expect(plugin.download).toHaveBeenCalled()
  })

  it('warns an iPhone below the 8 GB class and an Android phone below the 12 GB class', () => {
    expect(belowOfflineCaseyMemory(status(7.5e9), 'ios')).toBe(false)
    expect(belowOfflineCaseyMemory(status(5.7e9), 'ios')).toBe(true)
    // An "8 GB" Android phone may try (GemmaCapability.kt), but Google's
    // Gallery asks 12 GB for this model, so it is told she may not run.
    expect(belowOfflineCaseyMemory(status(7.5e9), 'android')).toBe(true)
    expect(belowOfflineCaseyMemory(status(11.2e9), 'android')).toBe(false)
    expect(belowOfflineCaseyMemory(status(undefined), 'android')).toBe(false)
  })

  it('reads the platform itself when none is given', () => {
    on(true, 'android')
    expect(belowOfflineCaseyMemory(status(7.5e9))).toBe(true)
    on(true, 'ios')
    expect(belowOfflineCaseyMemory(status(7.5e9))).toBe(false)
  })

  it('names example Android phones by their model names', () => {
    expect(OFFLINE_CASEY_ANDROID_EXAMPLES.length).toBeGreaterThan(0)
    for (const phone of OFFLINE_CASEY_ANDROID_EXAMPLES) expect(phone).toMatch(/^(Samsung )?Galaxy /)
  })

  it('downloads Gemma 4 E4B from the same pinned revision on both phones, each its own file', () => {
    expect(swiftPlugin).toContain(`private let modelBytes: Int64 = ${GEMMA_DOWNLOAD_BYTES.toLocaleString('en').replace(/,/g, '_')}`)
    const revision = /resolve\/([0-9a-f]{40})\//.exec(swiftPlugin)?.[1]
    expect(revision).toBeDefined()
    expect(pluginModel).toContain(`${revision}/gemma-4-E4B-it.litertlm?download=true`)
    // The iPhone's -gpu file holds GPU weights only, which Android's CPU
    // fallback cannot load (GemmaModel.kt): Android pins the general file.
    expect(swiftPlugin).toContain('gemma-4-E4B-it-gpu.litertlm')
    expect(pluginModel).toContain('const val NAME = "gemma-4-E4B-it.litertlm"')
    expect(pluginModel).toContain('const val BYTES = 3_659_530_240L')
    expect(pluginModel).toContain('const val SHA256 = "0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0"')
  })

  it('registers the Android half with Capacitor', () => {
    expect(pluginPackage.capacitor.android.src).toBe('android')
    expect(pluginPackage.files).toContain('android/src/')
  })
})
