import en from './translations/en.json'
import {QRCodeModal} from './QRCodeModal'
import React from 'react'
import QRCode from 'qrcode.react'
import {mockApp, mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockI18n} from 'tests/mock-i18n'
import {DefaultProviders} from 'tests/DefaultProviders'
import {Modal} from '@/components/Modal'

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

vi.mock('@/components/Modal', () => ({Modal: (props: any) => props.children}))

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
