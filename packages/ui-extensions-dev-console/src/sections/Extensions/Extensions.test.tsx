// eslint-disable-next-line @shopify/strict-component-boundaries
import {ExtensionRow} from './components/ExtensionRow'
import en from './translations/en.json'
import {Extensions} from './Extensions.js'
import React from 'react'
import {ExtensionServerClient} from '@shopify/ui-extensions-server-kit'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {DefaultProviders} from 'tests/DefaultProviders'
import {mockI18n} from 'tests/mock-i18n'

const i18n = mockI18n(en)

describe('Extensions', () => {
  let client: ExtensionServerClient

  beforeEach(() => {
    client = new ExtensionServerClient({connection: {url: 'ws://localhost'}})
  })

  afterEach(() => {
    client.connection.close()
  })

  test('renders ExtensionRow', async () => {
    const extensions = [mockExtension()]

    const container = render(<Extensions />, withProviders(DefaultProviders), {
      state: {extensions, store: 'shop1.myshopify.io'},
    })

    const rows = container.findAll(ExtensionRow)

    expect(rows).toHaveLength(extensions.length)

    rows.forEach((row, index) => {
      expect(row.prop('extension')).toStrictEqual(extensions[index])
    })
  })

  test('calls to set focused to true for the current extension', async () => {
    const focusExtension = mockExtension()
    const prevFocusedExtension = mockExtension()
    const sendSpy = vi.spyOn(client.connection, 'send').mockImplementation(() => undefined)

    const container = render(<Extensions />, withProviders(DefaultProviders), {
      client,
      state: {extensions: [focusExtension, prevFocusedExtension], store: 'shop1.myshopify.io'},
    })

    container.act(() => {
      container.find(ExtensionRow, {extension: focusExtension})?.trigger('onHighlight', focusExtension)
    })

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'dispatch',
        data: {type: 'focus', payload: [{uuid: focusExtension.uuid}]},
      }),
    )
  })

  test('clear focus state of all extensions when onClearHighlight for a row is triggered', async () => {
    const extension1 = mockExtension({focused: true} as any)
    const extension2 = mockExtension({focused: true} as any)
    const sendSpy = vi.spyOn(client.connection, 'send').mockImplementation(() => undefined)

    const container = render(<Extensions />, withProviders(DefaultProviders), {
      client,
      state: {extensions: [extension1, extension2], store: 'shop1.myshopify.io'},
    })

    container.act(() => {
      container.find(ExtensionRow, {extension: extension1})?.trigger('onClearHighlight')
    })

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'dispatch',
        data: {type: 'unfocus'},
      }),
    )
  })
})
