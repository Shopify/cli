import {Extensions} from './Extensions.js'
import {DefaultProviders} from 'tests/DefaultProviders'
import React from 'react'
import {ExtensionServerClient} from '@shopify/ui-extensions-server-kit'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {screen} from '@testing-library/react'

vi.mock('./components', () => ({
  ExtensionRow: ({uuid}: any) => <div data-testid={`extension-row-${uuid}`} />,
  PostPurchaseRow: () => null,
  AppHomeRow: () => <div data-testid="app-home-row" />,
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
    render(<Extensions />, withProviders(DefaultProviders))

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('app-home-row')).not.toBeInTheDocument()
    expect(screen.queryByTestId(/extension-row-/)).not.toBeInTheDocument()
  })

  test('renders <AppHomeRow/>', async () => {
    const extensions = [mockExtension()]

    render(<Extensions />, withProviders(DefaultProviders), {
      state: {extensions, store: 'shop1.myshopify.io', app: {url: 'mock.url', title: 'Mock App Title'}},
    })

    expect(screen.getByTestId('app-home-row')).toBeInTheDocument()
  })

  test('renders an <ExtensionRow/> for each Extension', async () => {
    const extension1 = mockExtension()
    const extension2 = mockExtension()
    const extensions = [extension1, extension2]

    render(<Extensions />, withProviders(DefaultProviders), {
      state: {extensions, store: 'shop1.myshopify.io'},
    })

    expect(screen.getAllByTestId(/extension-row-/)).toHaveLength(extensions.length)
    expect(screen.getByTestId(`extension-row-${extension1.uuid}`)).toBeInTheDocument()
    expect(screen.getByTestId(`extension-row-${extension2.uuid}`)).toBeInTheDocument()
  })
})
