import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// "Your plan" in Settings leans on two small native changes that no Windows
// check can compile: these text assertions keep them from quietly going away.
// The real proof is a StoreKit sandbox and a Play license tester on a phone.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('iOS: Apple\'s manage sheet and lifetime first', () => {
  const swift = read('../ios/App/App/PassPlugin.swift')

  it('exposes manageSubscriptions, which opens StoreKit\'s sheet and falls back to Apple\'s page', () => {
    expect(swift).toMatch(/CAPPluginMethod\(name: "manageSubscriptions", returnType: CAPPluginReturnPromise\)/)
    expect(swift).toMatch(/@objc func manageSubscriptions\(_ call: CAPPluginCall\)/)
    expect(swift).toMatch(/AppStore\.showManageSubscriptions\(in: scene\)/)
    expect(swift).toMatch(/URL\(string: "https:\/\/apps\.apple\.com\/account\/subscriptions"\)/)
    expect(swift).toMatch(/UIApplication\.shared\.open\(url\)/)
  })

  it('prefers lifetime when both are owned and reports every owned pass', () => {
    expect(swift).toMatch(/owned\.contains\(lifetimeID\) \? lifetimeID : ownedInOrder\.first/)
    expect(swift).toMatch(/"ownedProductIds": ownedInOrder/)
    expect(swift).not.toMatch(/currentPassEntitlement\(\)/)
  })
})

describe('Android: every owned pass reaches JavaScript', () => {
  it('puts ownedProductIds next to the lifetime-first productId', () => {
    const plugin = read('../android/app/src/main/java/com/kristofferwithk/cluecabulary/PassPlugin.java')
    expect(plugin).toMatch(/data\.put\("ownedProductIds", owned\)/)
    const entitlement = read('../android/app/src/main/java/com/kristofferwithk/cluecabulary/PassEntitlement.java')
    expect(entitlement).toMatch(/if \(productId == null \|\| LIFETIME\.equals\(id\)\) productId = id;/)
    expect(entitlement).toMatch(/final List<String> ownedProductIds;/)
  })

  it('keeps the package the Play subscription link names', () => {
    const gradle = read('../android/app/build.gradle')
    expect(gradle).toMatch(/applicationId "com\.kristofferwithk\.cluecabulary"/)
    const pass = read('../src/purchase/pass.ts')
    expect(pass).toMatch(/export const PLAY_PACKAGE = 'com\.kristofferwithk\.cluecabulary'/)
  })
})
