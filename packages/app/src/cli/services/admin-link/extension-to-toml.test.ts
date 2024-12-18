import {buildTomlObject} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

describe('extension-to-toml', () => {
  test('correctly builds a toml string for a app_link extension on a non embedded app', () => {
    // Given
    const appConfig = {
      path: '',
      name: 'app 1',
      client_id: '12345',
      application_url: 'http://example.com',
      embedded: false,
    }

    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'Admin link title',
      type: 'app_link',
      draftVersion: {
        context: 'COLLECTIONS#SHOW',
        config: '{"text":"Admin link label","url":"https://google.es"}',
      },
    }

    // When
    const got = buildTomlObject(extension1, [], appConfig)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "admin_link"
name = "Admin link label"
handle = "admin-link-title"

  [[extensions.targeting]]
  url = "https://google.es"
  target = "admin.collection-details.action.link"
`)
  })

  test('correctly builds a toml string for bulk_action extension with path in an embedded app', () => {
    // Given
    const appConfig = {
      path: '',
      name: 'app 1',
      client_id: '12345',
      application_url: 'http://example.com',
      embedded: true,
    }
    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'Bulk action title',
      type: 'bulk_action',
      draftVersion: {
        context: 'PRODUCTS#ACTION',
        config: '{"text":"Bulk action label","url":"https://google.es/action/product?product_id=123#hash"}',
      },
    }

    // When
    const got = buildTomlObject(extension1, [], appConfig)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "admin_link"
name = "Bulk action label"
handle = "bulk-action-title"

  [[extensions.targeting]]
  url = "app://action/product?product_id=123#hash"
  target = "admin.product-index.selection-action.link"
`)
  })
  test('correctly builds a toml string for bulk_action extension with no path in an embedded app', () => {
    // Given
    const appConfig = {
      path: '',
      name: 'app 1',
      client_id: '12345',
      application_url: 'http://example.com',
      embedded: true,
    }
    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'Bulk action title',
      type: 'bulk_action',
      draftVersion: {
        context: 'PRODUCTS#ACTION',
        config: '{"text":"Bulk action label","url":"https://google.es/"}',
      },
    }

    // When
    const got = buildTomlObject(extension1, [], appConfig)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "admin_link"
name = "Bulk action label"
handle = "bulk-action-title"

  [[extensions.targeting]]
  url = "app://"
  target = "admin.product-index.selection-action.link"
`)
  })
  test('correctly builds a toml string for bulk_action extension with no path but search query in an embedded app', () => {
    // Given
    const appConfig = {
      path: '',
      name: 'app 1',
      client_id: '12345',
      application_url: 'http://example.com',
      embedded: true,
    }
    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'Bulk action title',
      type: 'bulk_action',
      draftVersion: {
        context: 'PRODUCTS#ACTION',
        config: '{"text":"Bulk action label","url":"https://google.es?foo=bar"}',
      },
    }

    // When
    const got = buildTomlObject(extension1, [], appConfig)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "admin_link"
name = "Bulk action label"
handle = "bulk-action-title"

  [[extensions.targeting]]
  url = "app://?foo=bar"
  target = "admin.product-index.selection-action.link"
`)
  })
})
