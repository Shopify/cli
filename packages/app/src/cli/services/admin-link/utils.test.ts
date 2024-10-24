import {buildTomlObject} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'
import {contextToTarget} from './utils.js'

describe('admin link utils', () => {
  test('correctly parses from context `COLLECTIONS#SHOW` to target', () => {
    // Given
    const context = 'COLLECTIONS#SHOW'

    // When
    const target = contextToTarget(context)

    // Then
    expect(target).toEqual('admin.collection.item.action')
  })
  test('correctly parses from context `ORDERS#INDEX` to target', () => {
    // Given
    const context = 'ORDERS#INDEX'

    // When
    const target = contextToTarget(context)

    // Then
    expect(target).toEqual("admin.order.index.action")
  })
})
