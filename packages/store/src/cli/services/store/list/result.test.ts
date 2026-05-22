import {type ListStoredStoresResult, type StoreListEntry} from './index.js'
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

const bpEntry: StoreListEntry = {
  store: 'acme-prod.myshopify.com',
  kind: 'standard',
  userId: '999',
  organizationId: '1',
  organizationName: 'Acme Inc',
  storeType: 'PRODUCTION',
  displayName: 'Acme Production',
}

function localResult(entries: StoreListEntry[]): ListStoredStoresResult {
  return {entries, source: 'local'}
}

function bpResult(
  entries: StoreListEntry[],
  extra: Partial<ListStoredStoresResult> = {},
): ListStoredStoresResult {
  return {entries, source: 'bp', ...extra}
}

describe('writeStoreListResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  describe('local source', () => {
    test('renders an empty-state message pointing at `store auth` and `store create preview`', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(localResult([]), 'text')

      expect(output.info()).toContain('No stores authenticated locally.')
      expect(output.info()).toContain('shopify store auth')
      expect(output.info()).toContain('shopify store create preview')
    })

    test('renders a table row with the email for standard sessions', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(localResult([standardEntry]), 'text')

      const rendered = output.info()
      expect(rendered).toContain('b-shop.myshopify.com')
      expect(rendered).toContain('standard')
      expect(rendered).toContain('merchant@example.com')
    })

    test('renders a dash in the user column for preview sessions to avoid showing placeholder ids', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(localResult([previewEntry]), 'text')

      const rendered = output.info()
      expect(rendered).toContain('a-preview.myshopify.io')
      expect(rendered).toContain('preview')
      expect(rendered).toContain('\u2014')
      expect(rendered).not.toContain('placeholder:aaaa')
    })

    test('includes a footer summary counting both kinds and naming the source', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(localResult([standardEntry, previewEntry]), 'text')

      expect(output.info()).toContain('2 stores (1 standard, 1 preview) from local cache')
    })

    test('uses the singular noun for a single-entry summary', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(localResult([standardEntry]), 'text')

      expect(output.info()).toContain('1 store (1 standard, 0 preview) from local cache')
    })
  })

  describe('bp source', () => {
    test('renders an empty-state message that suggests the local fallback', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(bpResult([]), 'text')

      const rendered = output.info()
      expect(rendered).toContain('No stores accessible to the current Business Platform user.')
      expect(rendered).toContain('--source local')
    })

    test('prepends the notice to the empty-state output when present', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(
        bpResult([], {
          notice: 'Business Platform could not resolve the current session as a user account.',
        }),
        'text',
      )

      const rendered = output.info()
      expect(rendered).toMatch(/Business Platform could not resolve/i)
      expect(rendered).toContain('No stores accessible to the current Business Platform user.')
    })

    test('renders the BP table with org, name, and type columns', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(bpResult([bpEntry], {currentUserEmail: 'admin@acme.test'}), 'text')

      const rendered = output.info()
      expect(rendered).toContain('acme-prod.myshopify.com')
      expect(rendered).toContain('Acme Production')
      expect(rendered).toContain('PRODUCTION')
      expect(rendered).toContain('Acme Inc')
    })

    test('summary line mentions the BP source and the logged-in email when known', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(bpResult([bpEntry], {currentUserEmail: 'admin@acme.test'}), 'text')

      expect(output.info()).toContain('1 store from Business Platform (logged in as admin@acme.test)')
    })
  })

  describe('json format', () => {
    test('emits the full result wrapper (entries + source + notice) through the result channel', () => {
      const output = mockAndCaptureOutput()

      writeStoreListResult(
        bpResult([bpEntry], {currentUserEmail: 'admin@acme.test', notice: 'heads up'}),
        'json',
      )

      const parsed = JSON.parse(output.output())
      expect(parsed.source).toBe('bp')
      expect(parsed.entries).toEqual([bpEntry])
      expect(parsed.currentUserEmail).toBe('admin@acme.test')
      expect(parsed.notice).toBe('heads up')
    })
  })
})
