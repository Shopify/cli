import {ExtensionRow} from '.'
import en from './translations/en.json'
import {QRCodeModal} from '..'
import React from 'react'

import {DefaultProviders} from 'tests/DefaultProviders'
import {mockI18n} from 'tests/mock-i18n'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {Button} from '@/components'

vi.mock('./components', () => ({
  PreviewLinks: () => null,
}))

vi.mock('..', () => ({
  QRCodeModal: () => null,
  Row: (props: any) => props.children,
  Status: () => null,
}))

mockI18n(en)

describe('<ExtensionRow/>', () => {
  const legacyAdminExtension = mockExtension({type: 'product_subscription', surface: 'admin'})
  const legacyPosExtension = mockExtension({type: 'pos_ui_extension', surface: 'point_of_sale'})
  const legacyPostPurchaseExtension = mockExtension({type: 'post_purchase', surface: 'post-checkout'})
  const legacyCheckoutExtension = mockExtension({type: 'checkout_ui_extension', surface: 'checkout'})
  const adminUiExtension = mockExtension({
    type: 'ui_extension',
    surface: 'admin',
    extensionPoints: [{target: 'admin.product-details.block.render'}],
  })
  const checkoutUiExtension = mockExtension({
    type: 'ui_extension',
    surface: 'checkout',
    extensionPoints: [{target: 'purchase.checkout.cart-line-list.render-after'}],
  })

  const posUiExtension = mockExtension({
    type: 'ui_extension',
    extensionPoints: [{target: 'pos.home.tile.render', surface: 'point_of_sale'}],
  })

  const defaultProps = {
    uuid: legacyAdminExtension.uuid,
  }
  const defaultState = {
    extensions: [
      legacyAdminExtension,
      legacyPosExtension,
      legacyPostPurchaseExtension,
      legacyCheckoutExtension,
      adminUiExtension,
      checkoutUiExtension,
      posUiExtension,
    ],
  }

  test('renders a <QRCodeModal/>, closed by default', () => {
    const container = render(<ExtensionRow {...defaultProps} />, withProviders(DefaultProviders), {state: defaultState})

    expect(container).toContainReactComponent(QRCodeModal, {code: undefined})
  })

  test('renders a <Button/> to open the QRCodeModal for a POS UI extension', () => {
    const container = render(
      <ExtensionRow {...defaultProps} uuid={posUiExtension.uuid} />,
      withProviders(DefaultProviders),
      {
        state: defaultState,
      },
    )

    expect(container).toContainReactComponent(Button, {id: 'showQRCodeModalButton'})
  })

  test('renders a <Button/> to open the QRCodeModal for a legacy Admin extension', () => {
    const container = render(
      <ExtensionRow {...defaultProps} uuid={legacyAdminExtension.uuid} />,
      withProviders(DefaultProviders),
      {
        state: defaultState,
      },
    )

    expect(container).toContainReactComponent(Button, {id: 'showQRCodeModalButton'})
  })

  test('renders a <Button/> to open the QRCodeModal for a legacy POS extension', () => {
    const container = render(
      <ExtensionRow {...defaultProps} uuid={legacyPosExtension.uuid} />,
      withProviders(DefaultProviders),
      {
        state: defaultState,
      },
    )

    expect(container).toContainReactComponent(Button, {id: 'showQRCodeModalButton'})
  })

  test('does not render a <Button/> to open the QRCodeModal for a legacy Post purchase extension', () => {
    const container = render(
      <ExtensionRow {...defaultProps} uuid={legacyPostPurchaseExtension.uuid} />,
      withProviders(DefaultProviders),
      {
        state: defaultState,
      },
    )

    expect(container).not.toContainReactComponent(Button, {id: 'showQRCodeModalButton'})
  })

  test('does not render a <Button/> to open the QRCodeModal for a legacy Checkout extension', () => {
    const container = render(
      <ExtensionRow {...defaultProps} uuid={legacyCheckoutExtension.uuid} />,
      withProviders(DefaultProviders),
      {
        state: defaultState,
      },
    )

    expect(container).not.toContainReactComponent(Button, {id: 'showQRCodeModalButton'})
  })

  test('does not render a <Button/> to open the QRCodeModal for a Checkout UI extension', () => {
    const container = render(
      <ExtensionRow {...defaultProps} uuid={checkoutUiExtension.uuid} />,
      withProviders(DefaultProviders),
      {
        state: defaultState,
      },
    )

    expect(container).not.toContainReactComponent(Button, {id: 'showQRCodeModalButton'})
  })

  test('does not render a <Button/> to open the QRCodeModal for an Admin UI extension', () => {
    const container = render(
      <ExtensionRow {...defaultProps} uuid={adminUiExtension.uuid} />,
      withProviders(DefaultProviders),
      {
        state: defaultState,
      },
    )

    expect(container).not.toContainReactComponent(Button, {id: 'showQRCodeModalButton'})
  })

  test('Opens and closes the <QRCodeModal/> ', () => {
    const container = render(<ExtensionRow {...defaultProps} />, withProviders(DefaultProviders), {state: defaultState})

    container.act(() => {
      container.find(Button, {id: 'showQRCodeModalButton'})?.trigger('onClick')
    })

    expect(container).toContainReactComponent(QRCodeModal, {
      code: {
        url: legacyAdminExtension.development.root.url,
        type: legacyAdminExtension.surface,
        title: legacyAdminExtension.handle,
      },
    })

    container.act(() => {
      container.find(QRCodeModal)?.trigger('onClose')
    })

    expect(container).toContainReactComponent(QRCodeModal, {code: undefined})
  })
})
