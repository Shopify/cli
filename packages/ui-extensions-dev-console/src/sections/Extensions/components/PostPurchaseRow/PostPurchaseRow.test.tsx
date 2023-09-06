import en from './translations/en.json'
import {PostPurchaseModal} from './components'
import {PostPurchaseRow} from '..'
import React from 'react'

import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockI18n} from 'tests/mock-i18n'
import {DefaultProviders} from 'tests/DefaultProviders'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {Button} from '@/components'

vi.mock('./components', () => ({
  PostPurchaseModal: () => null,
}))

vi.mock('..', async () => {
  const actual: any = await vi.importActual('..')
  return {
    ...actual,
    ...{
      Row: (props: any) => props.children,
      Status: () => null,
    },
  }
})

mockI18n(en)

describe('<PostPurchaseRow/>', () => {
  const defaultProps = {
    uuid: '123',
  }

  test('renders a <PostPurchaseModal/>, closed by default', () => {
    const extension = {...mockExtension(), uuid: defaultProps.uuid}
    const container = render(<PostPurchaseRow {...defaultProps} />, withProviders(DefaultProviders), {
      state: {extensions: [extension], store: 'shop1.myshopify.io', app: {url: 'mock.url', title: 'Mock App Title'}},
    })

    expect(container).toContainReactComponent(PostPurchaseModal, {open: false, url: extension.development.root.url})
  })

  test('Open and closes the <PostPurchaseModal/> ', () => {
    const extension = {...mockExtension(), uuid: defaultProps.uuid}
    const container = render(<PostPurchaseRow {...defaultProps} />, withProviders(DefaultProviders), {
      state: {extensions: [extension], store: 'shop1.myshopify.io', app: {url: 'mock.url', title: 'Mock App Title'}},
    })

    container.act(() => {
      container.find(Button)?.trigger('onClick')
    })

    expect(container).toContainReactComponent(PostPurchaseModal, {open: true, url: extension.development.root.url})

    container.act(() => {
      container.find(PostPurchaseModal)?.trigger('onClose')
    })

    expect(container).toContainReactComponent(PostPurchaseModal, {open: false, url: extension.development.root.url})
  })
})
