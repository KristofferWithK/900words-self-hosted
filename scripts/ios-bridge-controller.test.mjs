import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The 900 Pass and the daily reminder are registered in exactly one place:
// `capacitorDidLoad` on the CAPBridgeViewController subclass that SceneDelegate
// puts at the root of the window. Nothing about that arrangement is checked by
// the compiler — a root controller of the wrong class, or a storyboard entry
// point quietly making a second stock one, still builds, still launches, and
// still shows every screen. Only the two native features go quiet, and only on
// a phone. These are cheap text assertions because the real check needs a Mac.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const withoutXMLComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, '')

describe('the iOS bridge view controller is chosen in one place', () => {
  it('registers both plugins on the subclass SceneDelegate constructs', () => {
    const plugin = read('../ios/App/App/PassPlugin.swift')
    expect(plugin).toMatch(/final class PassBridgeViewController: CAPBridgeViewController/)
    expect(plugin).toMatch(/registerPluginInstance\(PassPlugin\(\)\)/)
    expect(plugin).toMatch(/registerPluginInstance\(RemindersPlugin\(\)\)/)
    expect(plugin).not.toMatch(/registerPluginType/)

    const scene = read('../ios/App/App/SceneDelegate.swift')
    expect(scene).toMatch(/rootViewController = PassBridgeViewController\(\)/)
  })

  it('writes bridge registration and StoreKit offer diagnostics to OSLog', () => {
    const plugin = read('../ios/App/App/PassPlugin.swift')
    expect(plugin).toMatch(/import OSLog/)
    expect(plugin).toMatch(/passPluginLogger\.notice\("pass-plugin-registration completed/)
    expect(plugin).toMatch(/passPluginLogger\.notice\("pass-offers outcome=storekit-empty/)
    expect(plugin).toMatch(/passPluginLogger\.notice\("pass-offers outcome=storekit-products/)
    expect(plugin).toMatch(/passPluginLogger\.error\("pass-offers outcome=storekit-request-failed/)
    expect(plugin).toMatch(/Storefront\.current/)
    expect(plugin).toMatch(/SKPaymentQueue\.canMakePayments\(\)/)
    expect(plugin).toMatch(/displayPrice/)
    expect(plugin).toMatch(/safeStoreKitErrorCode/)
    expect(plugin).toMatch(/call\.reject\("StoreKit could not load ticket prices\.", diagnostic\.bridgeCode\)/)
  })

  it('names no storyboard entry point, so UIKit builds no second controller', () => {
    const plist = withoutXMLComments(read('../ios/App/App/Info.plist'))
    expect(plist).not.toMatch(/<key>\s*UISceneStoryboardFile\s*<\/key>/)
    expect(plist).not.toMatch(/<key>\s*UIMainStoryboardFile\s*<\/key>/)
    // The launch screen is a different storyboard and stays.
    expect(plist).toMatch(/<key>\s*UILaunchStoryboardName\s*<\/key>/)
  })

  it('keeps no Main.storyboard for the next reader to believe', () => {
    expect(existsSync(new URL('../ios/App/App/Base.lproj/Main.storyboard', import.meta.url))).toBe(false)
    expect(read('../ios/App/App.xcodeproj/project.pbxproj')).not.toMatch(/Main\.storyboard/)
  })
})
