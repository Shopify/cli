import {QRCodeModal} from './QRCodeModal'
import {DefaultProviders} from 'tests/DefaultProviders'
import React from 'react'
import {mockApp, mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'

const {ModalMock, QRCodeMock} = vi.hoisted(() => ({
  ModalMock: vi.fn(),
  QRCodeMock: vi.fn(),
}))

vi.mock('@/components/Modal', () => ({
  Modal: (props: any) => {
    ModalMock(props)
    return props.children
  },
}))

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: (props: any) => {
    QRCodeMock(props)
    return <canvas data-testid="qrcode" />
  },
}))

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
    ModalMock.mockClear()
    QRCodeMock.mockClear()
  })

  test('Renders <Modal/> closed if code is undefined', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    render(<QRCodeModal {...defaultProps} code={undefined} />, withProviders(DefaultProviders), {
      state: {app, store, extensions: [extension]},
    })

    expect(ModalMock).toHaveBeenLastCalledWith(expect.objectContaining({open: false}))
  })

  test('Renders <Modal/> open if code is defined', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    render(<QRCodeModal {...defaultProps} />, withProviders(DefaultProviders), {
      state: {app, store, extensions: [extension]},
    })

    expect(ModalMock).toHaveBeenLastCalledWith(expect.objectContaining({open: true, width: 'small'}))
  })

  test('renders QRCode for pos', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    render(
      <QRCodeModal {...defaultProps} code={{...defaultProps.code, type: 'point_of_sale'}} />,
      withProviders(DefaultProviders),
      {state: {app, store, extensions: [extension]}},
    )

    expect(QRCodeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({value: `com.shopify.pos://pos-ui-extensions?url=${defaultProps.code.url}`}),
    )
  })

  test('renders QRCode for app home', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    render(<QRCodeModal {...defaultProps} />, withProviders(DefaultProviders), {
      state: {app, store, extensions: [extension]},
    })

    expect(QRCodeMock).toHaveBeenLastCalledWith(expect.objectContaining({value: app.mobileUrl}))
  })

  test('renders QRCode for mobile', async () => {
    const app = mockApp()
    const store = 'example.com'
    const extension = mockExtension()

    render(
      <QRCodeModal {...defaultProps} code={{...defaultProps.code, type: 'checkout'}} />,
      withProviders(DefaultProviders),
      {state: {app, store, extensions: [extension]}},
    )

    expect(QRCodeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({value: `https://${store}/admin/extensions-dev/mobile?url=${defaultProps.code.url}`}),
    )
  })
})
