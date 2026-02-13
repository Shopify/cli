import {resolveConfig} from './config.js'
import {describe, expect, test, beforeEach, afterEach} from 'vitest'

describe('resolveConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
    delete process.env.SHOPIFY_CLI_PATH
    delete process.env.SHOPIFY_FLAG_STORE
    delete process.env.SHOPIFY_CLI_THEME_TOKEN
    delete process.env.SHOPIFY_FLAG_PATH
    delete process.env.SHOPIFY_MCP_TIMEOUT
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns defaults when no env vars or overrides are set', () => {
    // Given
    // no env vars, no overrides

    // When
    const config = resolveConfig()

    // Then
    expect(config.shopifyCliPath).toBe('shopify')
    expect(config.store).toBeUndefined()
    expect(config.themeAccessPassword).toBeUndefined()
    expect(config.path).toBeUndefined()
    expect(config.timeout).toBe(120_000)
  })

  test('reads shopifyCliPath from SHOPIFY_CLI_PATH env var', () => {
    // Given
    process.env.SHOPIFY_CLI_PATH = '/usr/local/bin/shopify'

    // When
    const config = resolveConfig()

    // Then
    expect(config.shopifyCliPath).toBe('/usr/local/bin/shopify')
  })

  test('reads store from SHOPIFY_FLAG_STORE env var', () => {
    // Given
    process.env.SHOPIFY_FLAG_STORE = 'my-store.myshopify.com'

    // When
    const config = resolveConfig()

    // Then
    expect(config.store).toBe('my-store.myshopify.com')
  })

  test('reads themeAccessPassword from SHOPIFY_CLI_THEME_TOKEN env var', () => {
    // Given
    process.env.SHOPIFY_CLI_THEME_TOKEN = 'shptka_secret123'

    // When
    const config = resolveConfig()

    // Then
    expect(config.themeAccessPassword).toBe('shptka_secret123')
  })

  test('reads path from SHOPIFY_FLAG_PATH env var', () => {
    // Given
    process.env.SHOPIFY_FLAG_PATH = '/home/user/my-theme'

    // When
    const config = resolveConfig()

    // Then
    expect(config.path).toBe('/home/user/my-theme')
  })

  test('reads timeout from SHOPIFY_MCP_TIMEOUT env var', () => {
    // Given
    process.env.SHOPIFY_MCP_TIMEOUT = '60000'

    // When
    const config = resolveConfig()

    // Then
    expect(config.timeout).toBe(60000)
  })

  test('falls back to default timeout when SHOPIFY_MCP_TIMEOUT is not a valid number', () => {
    // Given
    process.env.SHOPIFY_MCP_TIMEOUT = 'not-a-number'

    // When
    const config = resolveConfig()

    // Then
    expect(config.timeout).toBe(120_000)
  })

  test('overrides take precedence over env vars', () => {
    // Given
    process.env.SHOPIFY_CLI_PATH = '/env/shopify'
    process.env.SHOPIFY_FLAG_STORE = 'env-store.myshopify.com'
    process.env.SHOPIFY_CLI_THEME_TOKEN = 'env-token'
    process.env.SHOPIFY_FLAG_PATH = '/env/path'
    process.env.SHOPIFY_MCP_TIMEOUT = '30000'

    // When
    const config = resolveConfig({
      shopifyCliPath: '/override/shopify',
      store: 'override-store.myshopify.com',
      themeAccessPassword: 'override-token',
      path: '/override/path',
      timeout: 5000,
    })

    // Then
    expect(config.shopifyCliPath).toBe('/override/shopify')
    expect(config.store).toBe('override-store.myshopify.com')
    expect(config.themeAccessPassword).toBe('override-token')
    expect(config.path).toBe('/override/path')
    expect(config.timeout).toBe(5000)
  })

  test('overrides take precedence over defaults when no env vars are set', () => {
    // Given
    // no env vars

    // When
    const config = resolveConfig({
      shopifyCliPath: '/custom/shopify',
      timeout: 10000,
    })

    // Then
    expect(config.shopifyCliPath).toBe('/custom/shopify')
    expect(config.timeout).toBe(10000)
  })

  test('partial overrides merge with env vars and defaults', () => {
    // Given
    process.env.SHOPIFY_FLAG_STORE = 'env-store.myshopify.com'

    // When
    const config = resolveConfig({
      path: '/override/path',
    })

    // Then
    expect(config.shopifyCliPath).toBe('shopify')
    expect(config.store).toBe('env-store.myshopify.com')
    expect(config.path).toBe('/override/path')
    expect(config.timeout).toBe(120_000)
  })
})
