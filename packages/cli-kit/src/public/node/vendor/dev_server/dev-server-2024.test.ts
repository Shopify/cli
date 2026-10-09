import {afterEach, describe, expect, test, vi} from 'vitest'

describe('development host generation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test.each([
    ['partners', undefined, 'partners.shop.dev'],
    ['shopify', 'app', 'app.shop.dev'],
    ['shopify', 'shop1', 'shop1.my.shop.dev'],
    ['shopify', 'shop1-dev-api', 'shop1.dev-api.shop.dev'],
  ])('keeps the current domain for %s (%s)', async (project, prefix, expected) => {
    vi.stubEnv('USING_DEV', '1')
    vi.resetModules()
    const {createServer, setAssertRunning} = await import('./dev-server-2024.js')
    setAssertRunning(() => {})
    try {
      expect(createServer(project).host({nonstandardHostPrefix: prefix})).toEqual(expected)
    } finally {
      setAssertRunning(undefined)
    }
  })
})
