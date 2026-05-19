import {type StoreListEntry} from './index.js'
import {writeStoreListResult} from './result.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

const standardEntry: StoreListEntry = {
  store: 'b-shop.myshopify.com',
  kind: 'standard',
  userId: '42',
  email: 'merchant@example.com',
}

const previewEntry: StoreListEntry = {
  store: 'a-preview.myshopify.io',
  kind: 'preview',
  userId: 'placeholder:aaaa',
  placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  coreUrl: 'https://app.shop.dev',
}

describe('writeStoreListResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('renders an empty-state message when no sessions are stored', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult([], 'text')

    expect(output.info()).toContain('No stores authenticated.')
    expect(output.info()).toContain('shopify store auth')
    expect(output.info()).toContain('shopify store create preview')
  })

  test('renders a table row with the email for standard sessions', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult([standardEntry], 'text')

    const rendered = output.info()
    expect(rendered).toContain('b-shop.myshopify.com')
    expect(rendered).toContain('standard')
    expect(rendered).toContain('merchant@example.com')
  })

  test('renders a dash in the user column for preview sessions to avoid showing placeholder ids', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult([previewEntry], 'text')

    const rendered = output.info()
    expect(rendered).toContain('a-preview.myshopify.io')
    expect(rendered).toContain('preview')
    expect(rendered).toContain('\u2014')
    expect(rendered).not.toContain('placeholder:aaaa')
  })

  test('includes a footer summary counting both kinds', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult([standardEntry, previewEntry], 'text')

    expect(output.info()).toContain('2 stores (1 standard, 1 preview)')
  })

  test('uses the singular noun for a single-entry summary', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult([standardEntry], 'text')

    expect(output.info()).toContain('1 store (1 standard, 0 preview)')
  })

  test('emits machine-readable JSON through the result channel when format is json', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult([standardEntry, previewEntry], 'json')

    const parsed = JSON.parse(output.output())
    expect(parsed).toEqual([standardEntry, previewEntry])
  })
})
