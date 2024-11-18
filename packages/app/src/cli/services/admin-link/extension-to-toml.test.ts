import {buildTomlObject} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

describe('extension-to-toml', () => {
  test('correctly builds a toml string for a app_link', () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'Admin link title',
      type: 'app_link',
      draftVersion: {
        context: 'COLLECTIONS#SHOW',
        config: '{"text":"admin link label","url":"https://google.es"}',
      },
    }

    // When
    const got = buildTomlObject(extension1)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "admin_link"
name = "Admin link title"
handle = "admin-link-title"

  [[extensions.targeting]]
  text = "admin link label"
  url = "https://google.es"
  target = "admin.collection.item.link"
`)
  })

  test('correctly builds a toml string for a bulk_action', () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'Bulk action title',
      type: 'bulk_action',
      draftVersion: {
        context: 'PRODUCTS#ACTION',
        config: '{"text":"bulk action label","url":"https://google.es"}',
      },
    }

    // When
    const got = buildTomlObject(extension1)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "admin_link"
name = "Bulk action title"
handle = "bulk-action-title"

  [[extensions.targeting]]
  text = "bulk action label"
  url = "https://google.es"
  target = "admin.product.selection.link"
`)
  })
})
