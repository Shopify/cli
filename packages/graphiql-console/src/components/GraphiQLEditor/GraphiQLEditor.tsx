import React, {useMemo} from 'react'
import {GraphiQL} from 'graphiql'
import {createGraphiQLFetcher} from '@graphiql/toolkit'
import 'graphiql/graphiql.css'
import type {GraphiQLConfig} from '@/types/config'

interface GraphiQLEditorProps {
  config: GraphiQLConfig
  apiVersion: string
}

export function GraphiQLEditor({config, apiVersion}: GraphiQLEditorProps) {
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

    // Welcome tab
    tabs.push({
      query: `# Welcome to GraphiQL!
#
# Keyboard shortcuts:
#   Execute: Cmd/Ctrl + Enter
#   Prettify: Shift + Cmd/Ctrl + P
#   Settings: Cmd/Ctrl + ,
`,
    })

    // Add default queries from config
    if (config.defaultQueries) {
      config.defaultQueries.forEach(({query, variables, preface}) => {
        tabs.push({
          query: preface ? `${preface}\n${query}` : query,
          variables: variables ?? '{}',
        })
      })
    }

    // Add initial query from config if provided
    if (config.query) {
      tabs.push({
        query: config.query,
        variables: config.variables ?? '{}',
      })
    }

    return tabs
  }, [config.defaultQueries, config.query, config.variables])

  return (
    <GraphiQL
      fetcher={fetcher}
      defaultEditorToolsVisibility={true}
      isHeadersEditorEnabled={false}
      defaultTabs={defaultTabs}
      forcedTheme="light"
    />
  )
}
