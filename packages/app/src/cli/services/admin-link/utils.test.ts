import {contextToTarget} from './utils.js'
import {describe, expect, test} from 'vitest'

describe('admin link utils', () => {
  test('correctly parses from context `COLLECTIONS#SHOW` to target', () => {
    // Given
    const context = 'COLLECTIONS#SHOW'

    // When
    const target = contextToTarget(context)

    // Then
    expect(target).toEqual('admin.collection-details.action.link')
  })
  test('correctly parses from context `ORDERS#INDEX` to target', () => {
    // Given
    const context = 'ORDERS#INDEX'

    // When
    const target = contextToTarget(context)

    // Then
    expect(target).toEqual('admin.order-index.action.link')
  })
  test('correctly parses from context `CUSTOMERS#ACTION` to target', () => {
    // Given
    const context = 'CUSTOMERS#ACTION'

    // When
    const target = contextToTarget(context)

    // Then
    expect(target).toEqual('admin.customer-index.selection-action.link')
  })
})
