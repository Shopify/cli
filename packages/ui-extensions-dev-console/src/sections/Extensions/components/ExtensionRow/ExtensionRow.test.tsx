import {ExtensionRow} from '.'
import {DefaultProviders} from 'tests/DefaultProviders'
import React from 'react'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {screen, fireEvent} from '@testing-library/react'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'

const {QRCodeModalMock} = vi.hoisted(() => ({
  QRCodeModalMock: vi.fn(),
}))

vi.mock('./components', () => ({
  PreviewLinks: () => null,
}))

vi.mock('..', () => ({
  QRCodeModal: (props: any) => {
    QRCodeModalMock(props)
    return <div data-testid="qr-code-modal" onClick={props.onClose} />
  },
  Row: ({children, ...props}: any) => <tr {...props}>{children}</tr>,
  Status: () => null,
}))

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

  beforeEach(() => {
    QRCodeModalMock.mockClear()
  })

  test('renders a <QRCodeModal/>, closed by default', () => {
    render(<ExtensionRow {...defaultProps} />, withProviders(DefaultProviders), {state: defaultState})

    expect(QRCodeModalMock).toHaveBeenLastCalledWith(expect.objectContaining({code: undefined}))
  })

  test('renders a button to open the QRCodeModal for a POS UI extension', () => {
    render(<ExtensionRow {...defaultProps} uuid={posUiExtension.uuid} />, withProviders(DefaultProviders), {
      state: defaultState,
    })

    expect(screen.getByText('View mobile')).toBeInTheDocument()
  })

  test('renders a button to open the QRCodeModal for a legacy Admin extension', () => {
    render(<ExtensionRow {...defaultProps} uuid={legacyAdminExtension.uuid} />, withProviders(DefaultProviders), {
      state: defaultState,
    })

    expect(screen.getByText('View mobile')).toBeInTheDocument()
  })

  test('renders a button to open the QRCodeModal for a legacy POS extension', () => {
    render(<ExtensionRow {...defaultProps} uuid={legacyPosExtension.uuid} />, withProviders(DefaultProviders), {
      state: defaultState,
    })

    expect(screen.getByText('View mobile')).toBeInTheDocument()
  })

  test('does not render a button to open the QRCodeModal for a legacy Post purchase extension', () => {
    render(
      <ExtensionRow {...defaultProps} uuid={legacyPostPurchaseExtension.uuid} />,
      withProviders(DefaultProviders),
      {state: defaultState},
    )

    expect(screen.queryByText('View mobile')).not.toBeInTheDocument()
  })

  test('does not render a button to open the QRCodeModal for a legacy Checkout extension', () => {
    render(<ExtensionRow {...defaultProps} uuid={legacyCheckoutExtension.uuid} />, withProviders(DefaultProviders), {
      state: defaultState,
    })

    expect(screen.queryByText('View mobile')).not.toBeInTheDocument()
  })

  test('does not render a button to open the QRCodeModal for a Checkout UI extension', () => {
    render(<ExtensionRow {...defaultProps} uuid={checkoutUiExtension.uuid} />, withProviders(DefaultProviders), {
      state: defaultState,
    })

    expect(screen.queryByText('View mobile')).not.toBeInTheDocument()
  })

  test('does not render a button to open the QRCodeModal for an Admin UI extension', () => {
    render(<ExtensionRow {...defaultProps} uuid={adminUiExtension.uuid} />, withProviders(DefaultProviders), {
      state: defaultState,
    })

    expect(screen.queryByText('View mobile')).not.toBeInTheDocument()
  })

  test('Opens and closes the <QRCodeModal/> ', () => {
    render(<ExtensionRow {...defaultProps} />, withProviders(DefaultProviders), {state: defaultState})

    fireEvent.click(screen.getByText('View mobile'))

    expect(QRCodeModalMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        code: {
          url: legacyAdminExtension.development.root.url,
          type: legacyAdminExtension.surface,
          title: legacyAdminExtension.handle,
        },
      }),
    )

    fireEvent.click(screen.getByTestId('qr-code-modal'))

    expect(QRCodeModalMock).toHaveBeenLastCalledWith(expect.objectContaining({code: undefined}))
  })
})
