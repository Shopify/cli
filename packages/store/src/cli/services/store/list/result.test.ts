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

    expect(output.info()).toContain('Acme (1234)')
    expect(output.info()).toContain('Subdomain')
    expect(output.info()).toContain('my-shop')
    expect(output.info()).not.toContain('my-shop.myshopify.com')
    expect(output.info()).toContain('My Shop')
    expect(output.info()).toContain('Dev')
    expect(output.info()).toContain('May 22, 2026')
    expect(output.info()).toContain('shopify store auth list')
  })

  test('renders the organization row and the store auth hint in a single info banner above the table', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'organization',
        organization,
        stores: [
          {
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

    expect(trimmedLines(output.info())).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Listing stores.                                                             │
      │                                                                              │
      │  Organization  Acme (1234)                                                   │
      │                                                                              │
      │  To list stores authenticated directly with \`shopify store auth\`, run        │
      │  \`shopify store auth list\`.                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯

      Subdomain  Name     Type  Created
      ─────────  ───────  ────  ────────────
      my-shop    My Shop  Dev   May 22, 2026"
    `)
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
    expect(output.info()).toContain('shopify store auth list')
  })

  test('renders the selected organization empty state in the same banner shape', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult({source: 'organization', organization, stores: []}, 'text')

    expect(trimmedLines(output.info())).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  No stores found.                                                            │
      │                                                                              │
      │  Organization  Acme (1234)                                                   │
      │                                                                              │
      │  To list stores authenticated directly with \`shopify store auth\`, run        │
      │  \`shopify store auth list\`.                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('omits the organization row from the empty state when no organization is selected', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult({source: 'organization', stores: []}, 'text')

    expect(output.info()).toContain('No stores found.')
    expect(output.info()).toContain('shopify store auth list')
    expect(output.info()).not.toContain('Organization')
  })

  test('emits a {stores, organization} JSON document on stdout', () => {
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
      organization,
    })
  })

  test('includes unresolved-session notices in JSON output', () => {
    const output = mockAndCaptureOutput()

    writeStoreListResult(
      {
        source: 'organization',
        stores: [],
        notice: "Couldn't resolve a Shopify account for the current CLI session.",
      },
      'json',
    )

    expect(JSON.parse(output.output().slice(output.output().indexOf('{')))).toEqual({
      stores: [],
      notice: "Couldn't resolve a Shopify account for the current CLI session.",
    })
    expect(output.warn()).toContain("Couldn't resolve a Shopify account for the current CLI session.")
  })

  test('warns on stderr when the listing was truncated, in both text and json', () => {
    const result = {
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
    writeStoreListResult(result, 'text')
    expect(textOutput.warn()).toContain('Showing the 250 most recent stores in Acme. More stores exist')

    const jsonOutput = mockAndCaptureOutput()
    writeStoreListResult(result, 'json')
    expect(jsonOutput.warn()).toContain('Showing the 250 most recent stores in Acme. More stores exist')
    // The structured truncation flag is part of the JSON document on stdout (prose stays on stderr).
    expect(jsonOutput.output()).toContain('"truncated": true')
  })
})

// The banner pads every line out to the terminal width, which is narrow in the test environment.
// Trimming keeps the snapshots readable and free of trailing whitespace.
function trimmedLines(output: string): string {
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
}
