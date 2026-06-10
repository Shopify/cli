import {writeStoreListResult} from './result.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

const organization = {id: '1234', name: 'Acme'}

describe('writeStoreListResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('renders organization context and rows with subdomain, name, type, and created date', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'organization',
        organization,
        stores: [
          {
            id: 'gid://shopify/Shop/1',
            store: 'my-shop.myshopify.com',
            createdAt: '2026-05-22T00:00:00Z',
            organizationId: '1234',
            organizationName: 'Acme',
            name: 'My Shop',
            type: 'dev',
          },
        ],
      },
      'text',
    )

    expect(output.info()).toContain('Organization: Acme (1234)')
    expect(output.info()).toContain('Subdomain')
    expect(output.info()).toContain('my-shop')
    expect(output.info()).not.toContain('my-shop.myshopify.com')
    expect(output.info()).toContain('My Shop')
    expect(output.info()).toContain('Dev')
    expect(output.info()).toContain('May 22, 2026')
  })

  test('renders the subdomain handle for non-myshopify hosts (local dev)', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'organization',
        organization,
        stores: [
          {
            store: 'my-shop.my.shop.dev',
            createdAt: '2026-05-22T00:00:00Z',
            organizationId: '1234',
            organizationName: 'Acme',
            name: 'My Shop',
          },
        ],
      },
      'text',
    )

    expect(output.info()).toContain('my-shop')
    expect(output.info()).not.toContain('my-shop.my.shop.dev')
  })

  test('renders store-auth rows with subdomain and connected date', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'store-auth',
        stores: [{store: 'shop.myshopify.com', connectedAt: '2026-06-03T00:00:00Z'}],
      },
      'text',
    )

    expect(output.info()).toContain('Subdomain')
    expect(output.info()).toContain('Connected')
    expect(output.info()).toContain('shop')
    expect(output.info()).toContain('Jun 03, 2026')
  })

  test('writes the store-auth notice to stderr and the empty state to stdout', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'store-auth',
        stores: [],
        notice: 'Showing locally stored store auth instead.',
      },
      'text',
    )

    expect(output.warn()).toContain('Showing locally stored store auth instead.')
    expect(output.info()).toContain('No stores authenticated locally.')
  })

  test('writes the unresolved-session notice to stderr and the empty state to stdout', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'organization',
        stores: [],
        notice: "Couldn't resolve a Shopify account for the current CLI session.",
      },
      'text',
    )

    expect(output.warn()).toContain("Couldn't resolve a Shopify account for the current CLI session.")
    expect(output.info()).toContain('No stores were returned for the current CLI session.')
  })

  test('renders the selected organization empty state', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult({source: 'organization', organization, stores: []}, 'text')

    expect(output.info()).toContain('No stores found in Acme.')
  })

  test('renders the organization empty state and store-auth fallback guidance', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult({source: 'organization', stores: []}, 'text')

    expect(output.info()).toContain('No stores found in your Shopify organization.')
    expect(output.info()).toContain('Run `shopify store list --from store-auth` to inspect locally stored store auth.')
  })

  test('emits a {stores, source, organization} JSON document for organization results', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'organization',
        organization,
        stores: [
          {
            id: 'gid://shopify/Shop/1',
            store: 'shop.myshopify.com',
            createdAt: '2026-05-22T00:00:00Z',
            organizationId: '1234',
            organizationName: 'Acme',
            name: 'My Shop',
            type: 'dev',
          },
        ],
      },
      'json',
    )

    expect(JSON.parse(output.output())).toEqual({
      stores: [
        {
          id: 'gid://shopify/Shop/1',
          store: 'shop.myshopify.com',
          createdAt: '2026-05-22T00:00:00Z',
          organizationId: '1234',
          organizationName: 'Acme',
          name: 'My Shop',
          type: 'dev',
        },
      ],
      source: 'organization',
      organization,
    })
  })

  test('emits a {stores, source} JSON document for store-auth results', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'store-auth',
        stores: [{store: 'shop.myshopify.com', connectedAt: '2026-06-03T00:00:00Z'}],
      },
      'json',
    )

    expect(JSON.parse(output.output())).toEqual({
      stores: [{store: 'shop.myshopify.com', connectedAt: '2026-06-03T00:00:00Z'}],
      source: 'store-auth',
    })
  })

  test('warns on stderr when the listing was truncated, in both text and json', () => {
    const organizationResult = {
      source: 'organization' as const,
      organization,
      stores: [
        {
          store: 'shop.myshopify.com',
          createdAt: '2026-05-22T00:00:00Z',
          organizationId: '1234',
          organizationName: 'Acme',
        },
      ],
      truncated: true,
    }

    const textOutput = mockAndCaptureOutput()
    writeStoreListResult(organizationResult, 'text')
    expect(textOutput.warn()).toContain('Showing the 250 most recent stores in Acme. More stores exist')

    const jsonOutput = mockAndCaptureOutput()
    writeStoreListResult(organizationResult, 'json')
    expect(jsonOutput.warn()).toContain('Showing the 250 most recent stores in Acme. More stores exist')
    // The structured truncation flag is part of the JSON document on stdout (prose stays on stderr).
    expect(jsonOutput.output()).toContain('"truncated": true')
  })

  test('warns on stderr when the store-auth listing was truncated', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'store-auth',
        stores: [{store: 'shop.myshopify.com', connectedAt: '2026-06-03T00:00:00Z'}],
        truncated: true,
      },
      'text',
    )

    expect(output.warn()).toContain('Showing the 250 most recent stores. More stores exist')
  })

  test('emits truncated in JSON when the store-auth listing was truncated', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'store-auth',
        stores: [{store: 'shop.myshopify.com', connectedAt: '2026-06-03T00:00:00Z'}],
        truncated: true,
      },
      'json',
    )

    expect(output.warn()).toContain('Showing the 250 most recent stores. More stores exist')
    expect(output.output()).toContain('"source": "store-auth"')
    expect(output.output()).toContain('"truncated": true')
  })
})
