import {isStoreQueryTool, queryingTitle} from './progress.js'
import {RUN_ADMIN_GRAPHQL_TOOL_NAME, RUN_SHOPIFYQL_TOOL_NAME} from './tools.js'
import {describe, expect, test} from 'vitest'

describe('queryingTitle', () => {
  test('uses the plural form for zero queries', () => {
    expect(queryingTitle(0)).toBe('Querying your store (0 queries)')
  })

  test('uses the singular form for exactly one query', () => {
    expect(queryingTitle(1)).toBe('Querying your store (1 query)')
  })

  test('uses the plural form for more than one query', () => {
    expect(queryingTitle(2)).toBe('Querying your store (2 queries)')
  })
})

describe('isStoreQueryTool', () => {
  test('classifies both store-query tools as store-query tools', () => {
    expect(isStoreQueryTool(RUN_SHOPIFYQL_TOOL_NAME)).toBe(true)
    expect(isStoreQueryTool(RUN_ADMIN_GRAPHQL_TOOL_NAME)).toBe(true)
  })

  test('classifies any other tool name as a docs tool', () => {
    expect(isStoreQueryTool('search_docs_chunks')).toBe(false)
  })
})
