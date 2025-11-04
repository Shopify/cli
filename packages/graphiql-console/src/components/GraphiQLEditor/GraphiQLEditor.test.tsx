import {GraphiQLEditor} from './GraphiQLEditor.tsx'
import React from 'react'
import {render} from '@testing-library/react'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import type {GraphiQLConfig} from '@/types/config'

// Mock GraphiQL component
const mockGraphiQL = vi.fn()
vi.mock('graphiql', () => ({
  GraphiQL: (props: any) => {
    mockGraphiQL(props)
    return <div data-testid="graphiql-mock" data-tabs-count={props.defaultTabs?.length || 0} />
  },
}))

// Mock createGraphiQLFetcher
const mockCreateFetcher = vi.fn()
vi.mock('@graphiql/toolkit', () => ({
  createGraphiQLFetcher: (options: any) => {
    mockCreateFetcher(options)
    return vi.fn()
  },
}))

describe('<GraphiQLEditor />', () => {
  const baseConfig: GraphiQLConfig = {
    baseUrl: 'http://localhost:3457',
    apiVersion: '2024-10',
    apiVersions: ['2024-01', '2024-04', '2024-07', '2024-10', 'unstable'],
    appName: 'Test App',
    appUrl: 'http://localhost:3000',
    storeFqdn: 'test-store.myshopify.com',
  }

  beforeEach(() => {
    mockGraphiQL.mockClear()
    mockCreateFetcher.mockClear()
  })

  test('renders GraphiQL component', () => {
    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    expect(mockGraphiQL).toHaveBeenCalledTimes(1)
  })

  test('creates fetcher with correct URL including api_version', () => {
    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-07" />)

    expect(mockCreateFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:3457/graphiql/graphql.json?api_version=2024-07',
      }),
    )
  })

  test('creates fetcher without Authorization header when key is not provided', () => {
    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    expect(mockCreateFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {},
      }),
    )
  })

  test('creates fetcher with Authorization header when key is provided', () => {
    const configWithKey = {...baseConfig, key: 'test-api-key'}
    render(<GraphiQLEditor config={configWithKey} apiVersion="2024-10" />)

    expect(mockCreateFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-api-key',
        },
      }),
    )
  })

  test('passes ephemeral storage to GraphiQL', () => {
    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    expect(graphiqlCall.storage).toBeDefined()
    expect(typeof graphiqlCall.storage.getItem).toBe('function')
    expect(typeof graphiqlCall.storage.setItem).toBe('function')
  })

  test('ephemeral storage returns null for tabs key', () => {
    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const storage = graphiqlCall.storage

    expect(storage.getItem('tabs')).toBeNull()
  })

  test('ephemeral storage does not persist tabs on setItem', () => {
    // Mock localStorage
    const originalSetItem = Storage.prototype.setItem
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const storage = graphiqlCall.storage

    storage.setItem('tabs', '[]')
    expect(setItemSpy).not.toHaveBeenCalledWith('tabs', expect.anything())

    // Other keys should be persisted
    storage.setItem('other-key', 'value')
    expect(setItemSpy).toHaveBeenCalledWith('other-key', 'value')

    setItemSpy.mockRestore()
    Storage.prototype.setItem = originalSetItem
  })

  test('constructs defaultTabs with WELCOME_MESSAGE when no queries provided', () => {
    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const defaultTabs = graphiqlCall.defaultTabs

    // Should have WELCOME_MESSAGE + DEFAULT_SHOP_QUERY
    expect(defaultTabs).toHaveLength(2)
    expect(defaultTabs[0].query).toContain('Welcome to GraphiQL')
    expect(defaultTabs[1].query).toContain('query shopInfo')
  })

  test('includes initial query from config as third tab', () => {
    const configWithQuery = {
      ...baseConfig,
      query: 'query test { shop { name } }',
      variables: '{"var": "value"}',
    }
    render(<GraphiQLEditor config={configWithQuery} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const defaultTabs = graphiqlCall.defaultTabs

    // First tab is WELCOME_MESSAGE, second is DEFAULT_SHOP_QUERY, third is config query
    expect(defaultTabs[2].query).toBe('query test { shop { name } }')
    expect(defaultTabs[2].variables).toBe('{"var": "value"}')
  })

  test('always includes DEFAULT_SHOP_QUERY even if config has similar query', () => {
    const configWithShopQuery = {
      ...baseConfig,
      query: 'query shopInfo { shop { id name } }',
    }
    render(<GraphiQLEditor config={configWithShopQuery} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const defaultTabs = graphiqlCall.defaultTabs

    // Should have: WELCOME_MESSAGE + DEFAULT_SHOP_QUERY + config query (no deduplication)
    expect(defaultTabs).toHaveLength(3)
    expect(defaultTabs[0].query).toContain('Welcome to GraphiQL')
    expect(defaultTabs[1].query).toContain('query shopInfo')
    expect(defaultTabs[2].query).toContain('query shopInfo')
  })

  test('includes defaultQueries from config', () => {
    const configWithDefaultQueries = {
      ...baseConfig,
      defaultQueries: [
        {query: 'query products { products { edges { node { id } } } }'},
        {query: 'query orders { orders { edges { node { id } } } }', variables: '{"first": 10}'},
      ],
    }
    render(<GraphiQLEditor config={configWithDefaultQueries} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const defaultTabs = graphiqlCall.defaultTabs

    // Should have: WELCOME_MESSAGE + DEFAULT_SHOP_QUERY + 2 defaultQueries
    expect(defaultTabs).toHaveLength(4)
    expect(defaultTabs[2].query).toContain('query products')
    expect(defaultTabs[3].query).toContain('query orders')
    expect(defaultTabs[3].variables).toBe('{"first": 10}')
  })

  test('adds preface to defaultQueries when provided', () => {
    const configWithPreface = {
      ...baseConfig,
      defaultQueries: [
        {
          query: 'query test { shop { name } }',
          preface: '# This is a test query',
        },
      ],
    }
    render(<GraphiQLEditor config={configWithPreface} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const defaultTabs = graphiqlCall.defaultTabs

    expect(defaultTabs[2].query).toBe('# This is a test query\nquery test { shop { name } }')
  })

  test('WELCOME_MESSAGE is always the first tab', () => {
    const configWithMultipleQueries = {
      ...baseConfig,
      query: 'query initial { shop { id } }',
      defaultQueries: [
        {query: 'query products { products { edges { node { id } } } }'},
        {query: 'query orders { orders { edges { node { id } } } }'},
      ],
    }
    render(<GraphiQLEditor config={configWithMultipleQueries} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]
    const defaultTabs = graphiqlCall.defaultTabs

    // First tab should always be WELCOME_MESSAGE
    expect(defaultTabs[0].query).toContain('Welcome to GraphiQL')
  })

  test('passes correct props to GraphiQL', () => {
    render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    const graphiqlCall = mockGraphiQL.mock.calls[0][0]

    expect(graphiqlCall.fetcher).toBeDefined()
    expect(graphiqlCall.defaultEditorToolsVisibility).toBe(true)
    expect(graphiqlCall.isHeadersEditorEnabled).toBe(false)
    expect(graphiqlCall.forcedTheme).toBe('light')
    expect(graphiqlCall.defaultTabs).toBeDefined()
    expect(graphiqlCall.storage).toBeDefined()
  })

  test('updates fetcher when apiVersion changes', () => {
    const {rerender} = render(<GraphiQLEditor config={baseConfig} apiVersion="2024-10" />)

    expect(mockCreateFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:3457/graphiql/graphql.json?api_version=2024-10',
      }),
    )

    // Clear mock and rerender with new version
    mockCreateFetcher.mockClear()
    rerender(<GraphiQLEditor config={baseConfig} apiVersion="2024-07" />)

    // Note: Due to useMemo, the fetcher should recreate when apiVersion changes
    expect(mockCreateFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:3457/graphiql/graphql.json?api_version=2024-07',
      }),
    )
  })
})
