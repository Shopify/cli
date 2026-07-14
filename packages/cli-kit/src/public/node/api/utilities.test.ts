import {addCursorAndFiltersToAppLogsUrl} from './utilities.js'
import {describe, expect, test} from 'vitest'

describe('addCursorAndFiltersToAppLogsUrl', () => {
  test('returns the base URL when no cursor or filters are provided', () => {
    // Given
    const baseUrl = 'https://shopify.com/logs'

    // When
    const got = addCursorAndFiltersToAppLogsUrl(baseUrl)

    // Then
    expect(got).toBe('https://shopify.com/logs')
  })

  test('appends the cursor to the URL', () => {
    // Given
    const baseUrl = 'https://shopify.com/logs'
    const cursor = 'cursor123'

    // When
    const got = addCursorAndFiltersToAppLogsUrl(baseUrl, cursor)

    // Then
    expect(got).toBe('https://shopify.com/logs?cursor=cursor123')
  })

  test('appends the status filter to the URL', () => {
    // Given
    const baseUrl = 'https://shopify.com/logs'
    const filters = {status: 'success'}

    // When
    const got = addCursorAndFiltersToAppLogsUrl(baseUrl, undefined, filters)

    // Then
    expect(got).toBe('https://shopify.com/logs?status=success')
  })

  test('appends the source filter to the URL', () => {
    // Given
    const baseUrl = 'https://shopify.com/logs'
    const filters = {source: 'cli'}

    // When
    const got = addCursorAndFiltersToAppLogsUrl(baseUrl, undefined, filters)

    // Then
    expect(got).toBe('https://shopify.com/logs?source=cli')
  })

  test('appends both status and source filters to the URL', () => {
    // Given
    const baseUrl = 'https://shopify.com/logs'
    const filters = {status: 'error', source: 'app'}

    // When
    const got = addCursorAndFiltersToAppLogsUrl(baseUrl, undefined, filters)

    // Then
    const url = new URL(got)
    expect(url.origin + url.pathname).toBe('https://shopify.com/logs')
    expect(url.searchParams.get('status')).toBe('error')
    expect(url.searchParams.get('source')).toBe('app')
  })

  test('appends cursor and all filters to the URL', () => {
    // Given
    const baseUrl = 'https://shopify.com/logs'
    const cursor = 'cursor456'
    const filters = {status: 'info', source: 'web'}

    // When
    const got = addCursorAndFiltersToAppLogsUrl(baseUrl, cursor, filters)

    // Then
    const url = new URL(got)
    expect(url.origin + url.pathname).toBe('https://shopify.com/logs')
    expect(url.searchParams.get('cursor')).toBe('cursor456')
    expect(url.searchParams.get('status')).toBe('info')
    expect(url.searchParams.get('source')).toBe('web')
  })
})
