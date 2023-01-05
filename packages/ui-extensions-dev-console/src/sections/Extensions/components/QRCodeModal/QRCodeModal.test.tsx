import en from './translations/en.json'
import {QRCodeModal} from './QRCodeModal'
import React from 'react'
import QRCode from 'qrcode.react'
import {mockApp, mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockI18n} from 'tests/mock-i18n'
import {DefaultProviders} from 'tests/DefaultProviders'

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

const i18n = mockI18n(en)

describe('QRCodeModal', () => {
  const defaultProps = {
    onClose: vi.fn(),
    open: true,
    url: 'mock.url.com',
    title: 'mock ttle',
    type: 'home' as const,
  }

  test('does not render QRCode if url, title or type if undefined', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    expect(
      render(<QRCodeModal {...defaultProps} url={undefined} />, withProviders(DefaultProviders), {
        state: {app, store, extensions: [extension]},
      }),
    ).not.toContainReactComponent(QRCode)

    expect(
      render(<QRCodeModal {...defaultProps} title={undefined} />, withProviders(DefaultProviders), {
        state: {app, store, extensions: [extension]},
      }),
    ).not.toContainReactComponent(QRCode)

    expect(
      render(<QRCodeModal {...defaultProps} type={undefined} />, withProviders(DefaultProviders), {
        state: {app, store, extensions: [extension]},
      }),
    ).not.toContainReactComponent(QRCode)
  })

  test('renders QRCode for pos', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(<QRCodeModal {...defaultProps} type="point_of_sale" />, withProviders(DefaultProviders), {
      state: {app, store, extensions: [extension]},
    })

    expect(container).toContainReactComponent(QRCode, {
      value: `com.shopify.pos://pos-ui-extensions?url=${app.url}`,
    })
  })

  test.only('renders QRCode for app home', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()
    const container = render(<QRCodeModal {...defaultProps} />, withProviders(DefaultProviders), {
      state: {app, store, extensions: [extension]},
    })

    expect(container).toContainReactComponent(QRCode, {
      value: `https://${store}/admin/apps/${app.apiKey}`,
    })
  })
})
