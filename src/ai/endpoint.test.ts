import { describe, expect, it } from 'vitest'
import { AiError, DEFAULT_BASE_URL, resolveEndpoint } from './client'

describe('resolveEndpoint', () => {
  it('targets only the constrained Casey route', () => {
    expect(resolveEndpoint(DEFAULT_BASE_URL).href).toBe(`${DEFAULT_BASE_URL}/casey/decision`)
    expect(resolveEndpoint('https://example.test/custom/v1///').href).toBe(
      'https://example.test/custom/v1/casey/decision',
    )
  })

  it('requires an absolute encrypted URL except on the local machine', () => {
    for (const bad of [
      '',
      '/v1',
      'host.test/v1',
      '//host.test/v1',
      'http://host.test/v1',
      'file:///x',
      'https://user:password@host.test/v1',
      'https://host.test/v1?model=attacker',
      'https://host.test/v1#fragment',
    ]) {
      expect(() => resolveEndpoint(bad)).toThrow(AiError)
    }
    expect(resolveEndpoint('http://127.0.0.1:8787/v1').href).toBe(
      'http://127.0.0.1:8787/v1/casey/decision',
    )
  })
})
