import {Extensions} from './Extensions.js'

import {AppHomeRow, ExtensionRow} from './components'
import React from 'react'
import {ExtensionServerClient} from '@shopify/ui-extensions-server-kit'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {DefaultProviders} from 'tests/DefaultProviders'

vi.mock('./components', () => ({
  ExtensionRow: () => null,
  PostPurchaseRow: () => null,
  AppHomeRow: () => null,
  Row: () => null,
}))

describe('<Extensions/>', () => {
  let client: ExtensionServerClient

  beforeEach(() => {
    client = new ExtensionServerClient({connection: {url: 'ws://localhost'}})
  })

  afterEach(() => {
    client.connection.close()
  })

  test('renders a blank slate if there is no data', async () => {
    const container = render(<Extensions />, withProviders(DefaultProviders))

    expect(container).not.toContainReactComponent('table')
    expect(container).not.toContainReactComponent(AppHomeRow)
    expect(container).not.toContainReactComponent(ExtensionRow)
  })

  test('renders <AppHomeRow/>', async () => {
    const extensions = [mockExtension()]

    const container = render(<Extensions />, withProviders(DefaultProviders), {
      state: {extensions, store: 'shop1.myshopify.io', app: {url: 'mock.url', title: 'Mock App Title'}},
    })

    expect(container).toContainReactComponent(AppHomeRow)
  })

  test('renders an <ExtensionRow/> for each Extension', async () => {
    const extension1 = mockExtension()
    const extension2 = mockExtension()
    const extensions = [extension1, extension2]

    const container = render(<Extensions />, withProviders(DefaultProviders), {
      state: {extensions, store: 'shop1.myshopify.io'},
    })

    expect(container).toContainReactComponentTimes(ExtensionRow, extensions.length)
    expect(container).toContainReactComponent(ExtensionRow, {uuid: extension1.uuid})
    expect(container).toContainReactComponent(ExtensionRow, {uuid: extension2.uuid})
  })
})
