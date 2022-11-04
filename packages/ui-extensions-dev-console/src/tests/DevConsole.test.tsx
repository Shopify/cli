import {DevConsole} from '../DevConsole'
import {ExtensionRow} from '../ExtensionRow'
import {Action} from '../ActionSet/Action'
import en from '../translations/en.json'
import React from 'react'
import {Checkbox} from '@shopify/polaris'
import {ExtensionServerClient} from '@shopify/ui-extensions-server-kit'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {DefaultProviders} from 'tests/DefaultProviders'
import {mockI18n} from 'tests/mock-i18n'

const i18n = mockI18n(en)

describe('DevConsole', () => {
  test('renders ExtensionRow based on localStorage', async () => {
    const extensions = [mockExtension()]

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
      state: {extensions, store: 'shop1.myshopify.io'},
    })

    const rows = container.findAll(ExtensionRow)

    expect(rows).toHaveLength(extensions.length)

    rows.forEach((row, index) => {
      expect(row.prop('extension')).toStrictEqual(extensions[index])
    })
  })

  test('calls refresh with selected extensions', async () => {
    const selectedExtension = mockExtension()
    const unselectedExtension = mockExtension()
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}})
    const sendSpy = vi.spyOn(client.connection, 'send').mockImplementation(() => undefined)

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
      client,
      state: {extensions: [selectedExtension, unselectedExtension], store: 'shop1.myshopify.io'},
    })

    container.act(() => {
      container.find(ExtensionRow, {extension: selectedExtension})?.trigger('onSelect', selectedExtension)
    })

    container.find(Action, {accessibilityLabel: i18n.translate('extensionList.refresh')})?.trigger('onAction')

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'dispatch',
        data: {type: 'refresh', payload: [{uuid: selectedExtension.uuid}]},
      }),
    )
  })

  test('toggles selection of all extensions when select all checkbox is clicked', async () => {
    const extensions = [mockExtension(), mockExtension()]

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
      state: {extensions, store: 'shop1.myshopify.io'},
    })

    container.act(() => {
      container.find(Checkbox)?.trigger('onChange')
    })

    expect(container.findAll(ExtensionRow, {selected: true})).toHaveLength(extensions.length)

    container.act(() => {
      container.find(Checkbox)?.trigger('onChange')
    })

    expect(container.findAll(ExtensionRow, {selected: false})).toHaveLength(extensions.length)
  })

  test('toggles selection of individual extensions when onSelect for a row is triggered', async () => {
    const toggleExtension = mockExtension()
    const otherExtension = mockExtension()

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
      state: {extensions: [toggleExtension, otherExtension], store: 'shop1.myshopify.io'},
    })

    container.act(() => {
      container.find(ExtensionRow, {extension: toggleExtension})?.trigger('onSelect', toggleExtension)
    })

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: toggleExtension,
      selected: true,
    })

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: otherExtension,
      selected: false,
    })

    container.act(() => {
      container.find(ExtensionRow, {extension: toggleExtension})?.trigger('onSelect', toggleExtension)
    })

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: toggleExtension,
      selected: false,
    })

    expect(container).toContainReactComponent(ExtensionRow, {
      extension: otherExtension,
      selected: false,
    })
  })

  test('calls to set focused to true for the current extension', async () => {
    const focusExtension = mockExtension()
    const prevFocusedExtension = mockExtension()
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}})
    const sendSpy = vi.spyOn(client.connection, 'send').mockImplementation(() => undefined)

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
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
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}})
    const sendSpy = vi.spyOn(client.connection, 'send').mockImplementation(() => undefined)

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
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

  test('calls show with selected extensions', async () => {
    const unselectedExtension = mockExtension()
    const selectedExtension = mockExtension()
    selectedExtension.development.hidden = true
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}})
    const sendSpy = vi.spyOn(client.connection, 'send').mockImplementation(() => undefined)

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
      client,
      state: {extensions: [selectedExtension, unselectedExtension], store: 'shop1.myshopify.io'},
    })

    container.act(() => {
      container.find(ExtensionRow, {extension: selectedExtension})?.trigger('onSelect', selectedExtension)
    })

    container.act(() => {
      container.find(Action, {accessibilityLabel: i18n.translate('bulkActions.show')})?.trigger('onAction')
    })

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'update',
        data: {extensions: [{uuid: selectedExtension.uuid, development: {hidden: false}}]},
      }),
    )
  })

  test('calls hide with selected extensions', async () => {
    const selectedExtension = mockExtension()
    const unselectedExtension = mockExtension()
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}})
    const sendSpy = vi.spyOn(client.connection, 'send').mockImplementation(() => undefined)

    const container = render(<DevConsole />, withProviders(DefaultProviders), {
      client,
      state: {extensions: [selectedExtension, unselectedExtension], store: 'shop1.myshopify.io'},
    })

    container.act(() => {
      container.find(ExtensionRow, {extension: selectedExtension})?.trigger('onSelect', selectedExtension)
    })

    container.act(() => {
      container.find(Action, {accessibilityLabel: i18n.translate('bulkActions.hide')})?.trigger('onAction')
    })

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'update',
        data: {extensions: [{uuid: selectedExtension.uuid, development: {hidden: true}}]},
      }),
    )
  })
})
