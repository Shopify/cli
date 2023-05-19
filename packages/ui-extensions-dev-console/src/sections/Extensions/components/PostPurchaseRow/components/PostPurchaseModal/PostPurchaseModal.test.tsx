import en from './translations/en.json'
import {PostPurchaseModal} from './PostPurchaseModal'
import React from 'react'

import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockI18n} from 'tests/mock-i18n'
import {DefaultProviders} from 'tests/DefaultProviders'
import {Modal} from '@/components/Modal'

vi.mock('@/components/Modal', () => ({
  Modal: (props: any) => props.children,
}))

mockI18n(en)

describe('<PostPurchaseModal/>', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    url: 'mock.url.com',
  }

  test('renders a <Modal/>, closed when open is false', () => {
    const container = render(<PostPurchaseModal {...defaultProps} open={false} />, withProviders(DefaultProviders))

    expect(container).toContainReactComponent(Modal, {open: false, width: 'large'})
  })

  test('renders a <Modal/>, open when open is true', () => {
    const container = render(<PostPurchaseModal {...defaultProps} />, withProviders(DefaultProviders))

    expect(container).toContainReactComponent(Modal, {open: true, width: 'large'})
  })

  test('renders a link to the browser extension', () => {
    const container = render(<PostPurchaseModal {...defaultProps} />, withProviders(DefaultProviders))

    expect(container).toContainReactComponent('a', {
      href: 'https://chrome.google.com/webstore/detail/shopify-post-purchase-dev/nenmcifhoegealiiblnpihbnjenleong',
      target: '_blank',
    })
  })

  test('renders the URL for the extension', () => {
    const container = render(<PostPurchaseModal {...defaultProps} />, withProviders(DefaultProviders))

    expect(container).toContainReactText(defaultProps.url)
  })
})
