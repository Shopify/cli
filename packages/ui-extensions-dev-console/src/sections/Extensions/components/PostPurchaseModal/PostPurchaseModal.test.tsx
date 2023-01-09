import en from './translations/en.json'
import {PostPurchaseModal} from './PostPurchaseModal'
import React from 'react'

import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockI18n} from 'tests/mock-i18n'
import {DefaultProviders} from 'tests/DefaultProviders'
import {Modal} from '@shopify/polaris'

mockI18n(en)

describe('<PostPurchaseModal/>', () => {
  const defaultProps = {
    onClose: vi.fn(),
    url: 'mock.url.com',
  }

  test('renders a <Modal/> closed when url is undefined', () => {
    const container = render(<PostPurchaseModal {...defaultProps} url={undefined} />, withProviders(DefaultProviders))

    expect(container).toContainReactComponent(Modal, {open: false})
  })

  test('renders a <Modal/> open when url is a string', () => {
    const container = render(<PostPurchaseModal {...defaultProps} />, withProviders(DefaultProviders))

    expect(container).toContainReactComponent(Modal, {open: true})
  })

  test('renders a link to the browser extension when url is a string', () => {
    const container = render(<PostPurchaseModal {...defaultProps} />, withProviders(DefaultProviders))

    expect(container).toContainReactComponent('a', {
      href: 'https://github.com/Shopify/post-purchase-devtools/releases',
      target: '_blank',
    })
  })

  test('renders the URL for the extension when url is a string', () => {
    const container = render(<PostPurchaseModal {...defaultProps} />, withProviders(DefaultProviders))

    expect(container).toContainReactText(defaultProps.url)
  })
})
