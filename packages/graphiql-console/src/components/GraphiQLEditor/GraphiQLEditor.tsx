import React, {useMemo} from 'react'
import {GraphiQL} from 'graphiql'
import {createGraphiQLFetcher} from '@graphiql/toolkit'
import 'graphiql/style.css'
import type {GraphiQLConfig} from '@/types/config'

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
        if (key === 'tabs') return null // Always use defaultTabs
        return localStorage.getItem(key)
      },
      setItem(key, value) {
        if (key === 'tabs') return // Don't persist tabs
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

    // Add initial query from config first (if provided)
    if (config.query) {
      tabs.push({
        query: config.query,
        variables: config.variables ?? '{}',
      })
    }

    // Add default queries from config
    if (config.defaultQueries) {
      config.defaultQueries.forEach(({query, variables, preface}) => {
        tabs.push({
          query: preface ? `${preface}\n${query}` : query,
          variables: variables ?? '{}',
        })
      })
    }

    // Welcome tab (last)
    tabs.push({
      query: `# Welcome to GraphiQL!
#
# Keyboard shortcuts:
#   Execute: Cmd/Ctrl + Enter
#   Prettify: Shift + Cmd/Ctrl + P
#   Settings: Cmd/Ctrl + ,
`,
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
