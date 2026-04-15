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

  test('writes browser guidance to stderr and json success to stdout', () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    const streams = captureStandardStreams()
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
})
