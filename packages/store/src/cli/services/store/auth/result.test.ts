import {createStoreAuthPresenter} from './result.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

function captureStandardStreams() {
  const stdout: string[] = []
  const stderr: string[] = []

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stdout.write)
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stderr.write)

  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
    restore: () => {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    },
  }
}

describe('store auth presenter', () => {
  const originalUnitTestEnv = process.env.SHOPIFY_UNIT_TEST

  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  afterEach(() => {
    process.env.SHOPIFY_UNIT_TEST = originalUnitTestEnv
  })

  test('renders human success output in text mode', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('text')

    presenter.success({
      store: 'shop.myshopify.com',
      userId: '42',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      hasRefreshToken: true,
      associatedUser: {id: 42, email: 'merchant@example.com'},
    })

    expect(output.completed()).toContain('Logged in.')
    expect(output.completed()).toContain('Authenticated as merchant@example.com against shop.myshopify.com.')
    expect(output.info()).toContain(
      "shopify store execute --store shop.myshopify.com --query 'query { shop { name id } }'",
    )
    expect(output.output()).not.toContain('"store": "shop.myshopify.com"')
  })

  test('writes json success output through the result channel', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('json')

    presenter.success({
      store: 'shop.myshopify.com',
      userId: '42',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      hasRefreshToken: true,
      associatedUser: {id: 42, email: 'merchant@example.com'},
    })

    expect(output.output()).toContain('"store": "shop.myshopify.com"')
    expect(output.completed()).not.toContain('Authenticated')
    expect(output.info()).not.toContain('shopify store execute')
  })

  test('writes browser guidance to stderr and json success to stdout', async () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const streams = captureStandardStreams()
    const {createStoreAuthPresenter} = await import('./result.js')
    const presenter = createStoreAuthPresenter('json')

    try {
      presenter.openingBrowser()
      presenter.manualAuthUrl('https://shop.myshopify.com/admin/oauth/authorize?client_id=test')
      presenter.success({
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: '2026-04-02T00:00:00.000Z',
        hasRefreshToken: true,
        associatedUser: {id: 42, email: 'merchant@example.com'},
      })
    } finally {
      streams.restore()
    }

    expect(streams.stderr()).toContain('Shopify CLI will open the app authorization page in your browser.')
    expect(streams.stderr()).toContain('Browser did not open automatically. Open this URL manually:')
    expect(streams.stderr()).toContain('https://shop.myshopify.com/admin/oauth/authorize?client_id=test')
    expect(streams.stdout()).toContain('"store": "shop.myshopify.com"')
    expect(streams.stdout()).not.toContain('Authenticated')
  })

  test('does not print manual auth URL output when marked sensitive', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('text')

    const surfaced = presenter.manualAuthUrl(
      'https://shop.myshopify.com/admin/oauth/authorize?client_id=test&secret=sensitive',
      {sensitive: true},
    )

    expect(surfaced).toBe(false)

    expect(output.info()).toContain(
      'Browser did not open automatically. The manual authorization URL contains sensitive credentials and was not printed.',
    )
    expect(output.info()).toContain(
      'Run this command again in an environment where Shopify CLI can open a browser automatically.',
    )
    expect(output.info()).not.toContain('secret=sensitive')
    expect(output.info()).not.toContain('https://shop.myshopify.com/admin/oauth/authorize')
  })

  test('withholds a manual auth URL carrying a signup credential even when the caller does not mark it sensitive', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('text')

    const surfaced = presenter.manualAuthUrl(
      'https://shop.myshopify.com/admin/oauth/authorize?client_id=test&signup=signed.signup.jwt',
    )

    expect(surfaced).toBe(false)

    expect(output.info()).toContain(
      'Browser did not open automatically. The manual authorization URL contains sensitive credentials and was not printed.',
    )
    expect(output.info()).not.toContain('signed.signup.jwt')
    expect(output.info()).not.toContain('signup=')
  })

  test('withholds a manual auth URL it cannot parse', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('text')

    const surfaced = presenter.manualAuthUrl('not-a-url?signup=signed.signup.jwt')

    expect(surfaced).toBe(false)

    expect(output.info()).toContain(
      'Browser did not open automatically. The manual authorization URL contains sensitive credentials and was not printed.',
    )
    expect(output.info()).not.toContain('signed.signup.jwt')
  })

  test('prints a loopback handoff URL that carries no credential', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('text')

    const surfaced = presenter.manualAuthUrl('http://127.0.0.1:13387/auth/handoff?nonce=abc123')

    expect(surfaced).toBe(true)

    expect(output.info()).toContain('Browser did not open automatically. Open this URL manually:')
    expect(output.info()).toContain('http://127.0.0.1:13387/auth/handoff?nonce=abc123')
  })
})
