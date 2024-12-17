import {requestIdsCollection} from './request-ids.js'
import {describe, test, expect, beforeEach} from 'vitest'

describe('RequestIDCollection', () => {
  beforeEach(() => {
    requestIdsCollection.clear()
  })

  test('starts with an empty collection', () => {
    expect(requestIdsCollection.getRequestIds()).toEqual([])
  })

  test('adds request IDs to collection', () => {
    // When
    requestIdsCollection.addRequestId('request-1')
    requestIdsCollection.addRequestId('request-2')

    // Then
    expect(requestIdsCollection.getRequestIds()).toEqual(['request-1', 'request-2'])
  })

  test('ignores undefined or null request IDs', () => {
    // When
    requestIdsCollection.addRequestId(undefined)
    requestIdsCollection.addRequestId(null)
    requestIdsCollection.addRequestId('request-1')

    // Then
    expect(requestIdsCollection.getRequestIds()).toEqual(['request-1'])
  })

  test('limits collection to MAX_REQUEST_IDS', () => {
    // When
    for (let i = 0; i < 120; i++) {
      requestIdsCollection.addRequestId(`request-${i}`)
    }

    // Then
    expect(requestIdsCollection.getRequestIds()).toHaveLength(100)
    expect(requestIdsCollection.getRequestIds()[0]).toBe('request-0')
    expect(requestIdsCollection.getRequestIds()[99]).toBe('request-99')
  })

  test('clear() removes all request IDs', () => {
    // Given
    requestIdsCollection.addRequestId('request-1')
    requestIdsCollection.addRequestId('request-2')

    // When
    requestIdsCollection.clear()

    // Then
    expect(requestIdsCollection.getRequestIds()).toEqual([])
  })

  test('maintains singleton instance', () => {
    // Given
    requestIdsCollection.addRequestId('request-1')

    // When
    const sameInstance = requestIdsCollection
    sameInstance.addRequestId('request-2')

    // Then
    expect(requestIdsCollection.getRequestIds()).toEqual(['request-1', 'request-2'])
    expect(sameInstance.getRequestIds()).toEqual(['request-1', 'request-2'])
  })
})
