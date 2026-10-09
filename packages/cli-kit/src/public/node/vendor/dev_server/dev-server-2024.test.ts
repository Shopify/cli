import {createServer, setAssertRunning} from './dev-server-2024.js'
import {afterEach, describe, expect, test, vi} from 'vitest'

describe('development host generation', () => {
  afterEach(() => {
    setAssertRunning(undefined)
    vi.unstubAllEnvs()
  })

  test.each([
    ['partners', undefined, 'partners.shop.dev'],
    ['shopify', 'app', 'app.shop.dev'],
    ['shopify', 'shop1', 'shop1.my.shop.dev'],
    ['shopify', 'shop1-dev-api', 'shop1.dev-api.shop.dev'],
  ])('keeps the current domain for %s (%s)', (project, prefix, expected) => {
    vi.stubEnv('USING_DEV', '1')
    setAssertRunning(() => {})
    expect(createServer(project).host({nonstandardHostPrefix: prefix})).toEqual(expected)
  })
})
