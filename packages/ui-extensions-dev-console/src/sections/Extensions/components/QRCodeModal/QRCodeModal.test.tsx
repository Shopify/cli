import en from './translations/en.json'
import {QRCodeModal} from './QRCodeModal'
import React from 'react'
import QRCode from 'qrcode.react'
import {mockApp, mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockI18n} from 'tests/mock-i18n'
import {DefaultProviders} from 'tests/DefaultProviders'
import {ExternalIcon} from '@shopify/polaris-icons'
import {Modal} from '@/components/Modal'
import {IconButton} from '@/components/IconButton'

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

vi.mock('@/components/Modal', () => ({Modal: (props: any) => props.children}))

let isMobile = false
vi.mock('@/utilities/device', () => ({isMobileDevice: () => isMobile}))

mockI18n(en)

describe('QRCodeModal', () => {
  const defaultProps = {
    onClose: vi.fn(),
    code: {
      url: 'mock.url.com',
      title: 'mock ttle',
      type: 'home' as const,
    },
  }

  beforeEach(() => {
    isMobile = false
  })

  test('Renders <Modal/> closed if code is undefined', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    expect(
      render(<QRCodeModal {...defaultProps} code={undefined} />, withProviders(DefaultProviders), {
        state: {app, store, extensions: [extension]},
      }),
    ).toContainReactComponent(Modal, {open: false})
  })

  test('Renders <Modal/> open if code is undefined', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    expect(
      render(<QRCodeModal {...defaultProps} />, withProviders(DefaultProviders), {
        state: {app, store, extensions: [extension]},
      }),
    ).toContainReactComponent(Modal, {open: true, width: 'small'})
  })

  test('renders QRCode for pos', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(
      <QRCodeModal {...defaultProps} code={{...defaultProps.code, type: 'point_of_sale'}} />,
      withProviders(DefaultProviders),
      {
        state: {app, store, extensions: [extension]},
      },
    )

    expect(container).toContainReactComponent(QRCode, {
      value: `com.shopify.pos://pos-ui-extensions?url=${defaultProps.code.url}`,
    })
  })

  test('renders Open in Shopify POS CTA for pos on mobile', async () => {
    isMobile = true

    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(
      <QRCodeModal {...defaultProps} code={{...defaultProps.code, type: 'point_of_sale'}} />,
      withProviders(DefaultProviders),
      {
        state: {app, store, extensions: [extension]},
      },
    )

    expect(container).toContainReactComponent(IconButton, {
      source: ExternalIcon,
      accessibilityLabel: en.qrcode.openPos,
    })
  })

  test('does not render Open in Shopify POS CTA for pos on desktop', async () => {
    isMobile = false

    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(
      <QRCodeModal {...defaultProps} code={{...defaultProps.code, type: 'point_of_sale'}} />,
      withProviders(DefaultProviders),
      {
        state: {app, store, extensions: [extension]},
      },
    )

    expect(container).not.toContainReactComponent(IconButton, {
      source: ExternalIcon,
    })
  })

  test('does not render Open in Shopify POS CTA for non-pos types on mobile', async () => {
    isMobile = true

    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(
      <QRCodeModal {...defaultProps} code={{...defaultProps.code, type: 'checkout'}} />,
      withProviders(DefaultProviders),
      {
        state: {app, store, extensions: [extension]},
      },
    )

    expect(container).not.toContainReactComponent(IconButton, {
      source: ExternalIcon,
    })
  })

  test('renders QRCode for app home', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(<QRCodeModal {...defaultProps} />, withProviders(DefaultProviders), {
      state: {app, store, extensions: [extension]},
    })

    expect(container).toContainReactComponent(QRCode, {
      value: app.mobileUrl,
    })
  })

  test('renders QRCode for mobile', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(
      <QRCodeModal {...defaultProps} code={{...defaultProps.code, type: 'checkout'}} />,
      withProviders(DefaultProviders),
      {
        state: {app, store, extensions: [extension]},
      },
    )

    expect(container).toContainReactComponent(QRCode, {
      value: `https://${store}/admin/extensions-dev/mobile?url=${defaultProps.code.url}`,
    })
  })
})
