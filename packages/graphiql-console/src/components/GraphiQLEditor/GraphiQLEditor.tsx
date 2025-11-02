import React, {useMemo} from 'react'
import {GraphiQL} from 'graphiql'
import {createGraphiQLFetcher} from '@graphiql/toolkit'
import 'graphiql/style.css'
import type {GraphiQLConfig} from '@/types/config'
import {WELCOME_MESSAGE, DEFAULT_SHOP_QUERY} from '@/constants/defaultContent.ts'

interface GraphiQLEditorProps {
  config: GraphiQLConfig
  apiVersion: string
}

export function GraphiQLEditor({config, apiVersion}: GraphiQLEditorProps) {
  // Create ephemeral storage to prevent localStorage tab caching
  const ephemeralStorage: typeof localStorage = useMemo(() => {
    return {
      ...localStorage,
      getItem(key) {
        // Always use defaultTabs
        if (key === 'tabs') return null
        return localStorage.getItem(key)
      },
      setItem(key, value) {
        // Don't persist tabs
        if (key === 'tabs') return
        localStorage.setItem(key, value)
      },
      removeItem(key) {
        localStorage.removeItem(key)
      },
      clear() {
        localStorage.clear()
      },
      key(index) {
        return localStorage.key(index)
      },
      get length() {
        return localStorage.length
      },
    }
  }, [])

  // Create fetcher with current API version
  const fetcher = useMemo(() => {
    const url = `${config.baseUrl}/graphiql/graphql.json?api_version=${apiVersion}`

    return createGraphiQLFetcher({
      url,
      headers: config.key
        ? {
            Authorization: `Bearer ${config.key}`,
          }
        : {},
    })
  }, [config.baseUrl, config.key, apiVersion])

  // Prepare default tabs
  const defaultTabs = useMemo(() => {
    const tabs = []

    // 1. Add initial query from config FIRST (if provided)
    if (config.query) {
      tabs.push({
        query: config.query,
        variables: config.variables ?? '{}',
      })
    }

    // 2. Add DEFAULT_SHOP_QUERY SECOND (if not already in config)
    const hasShopQuery =
      config.query?.includes('query shopInfo') ?? config.defaultQueries?.some((q) => q.query.includes('query shopInfo'))
    if (!hasShopQuery) {
      tabs.push({
        query: DEFAULT_SHOP_QUERY,
        variables: '{}',
      })
    }

    // 3. Add default queries from config
    if (config.defaultQueries) {
      config.defaultQueries.forEach(({query, variables, preface}) => {
        tabs.push({
          query: preface ? `${preface}\n${query}` : query,
          variables: variables ?? '{}',
        })
      })
    }

    // 4. WELCOME_MESSAGE tab LAST
    tabs.push({
      query: WELCOME_MESSAGE,
    })

    return tabs
  }, [config.defaultQueries, config.query, config.variables])

  return (
    <GraphiQL
      fetcher={fetcher}
      defaultEditorToolsVisibility={true}
      isHeadersEditorEnabled={false}
      defaultTabs={defaultTabs}
      forcedTheme="light"
      storage={ephemeralStorage}
    />
  )
}
