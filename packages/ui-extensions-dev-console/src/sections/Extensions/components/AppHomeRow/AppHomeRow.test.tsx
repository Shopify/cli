import {AppHomeRow} from '.'
import {DefaultProviders} from 'tests/DefaultProviders'
import React from 'react'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {screen, fireEvent} from '@testing-library/react'

const {QRCodeModalMock, PreviewLinkMock} = vi.hoisted(() => ({
  QRCodeModalMock: vi.fn(),
  PreviewLinkMock: vi.fn(),
}))

vi.mock('..', () => ({
  NotApplicable: () => null,
  PreviewLink: (props: any) => {
    PreviewLinkMock(props)
    return null
  },
  QRCodeModal: (props: any) => {
    QRCodeModalMock(props)
    return <div data-testid="qr-code-modal" onClick={props.onClose} />
  },
  Row: ({children}: any) => <tr>{children}</tr>,
}))

describe('<AppHomeRow/>', () => {
  const defaultState = {
    app: {url: 'mock.url', title: 'Mock App Title'},
  }

  beforeEach(() => {
    QRCodeModalMock.mockClear()
    PreviewLinkMock.mockClear()
  })

  test('renders a <QRCodeModal/>, closed by default', () => {
    render(<AppHomeRow />, withProviders(DefaultProviders), {state: defaultState})

    expect(QRCodeModalMock).toHaveBeenLastCalledWith(expect.objectContaining({code: undefined}))
  })

  test('Opens and closes the <QRCodeModal/> ', () => {
    render(<AppHomeRow />, withProviders(DefaultProviders), {state: defaultState})

    fireEvent.click(screen.getByText('View mobile'))

    expect(QRCodeModalMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        code: {
          url: defaultState.app.url,
          type: 'home',
          title: defaultState.app.title,
        },
      }),
    )

    fireEvent.click(screen.getByTestId('qr-code-modal'))

    expect(QRCodeModalMock).toHaveBeenLastCalledWith(expect.objectContaining({code: undefined}))
  })

  test("renders a <PreviewLink/> with the resource url set to the app's handle if the surface has been set to 'admin'", () => {
    const appState = {
      app: {url: 'mock.url', title: 'Mock App Title', handle: 'my-app-handle'},
    }
    render(<AppHomeRow />, withProviders(DefaultProviders), {
      state: appState,
      client: {options: {surface: 'admin'}},
    })

    expect(PreviewLinkMock).toHaveBeenLastCalledWith(
      expect.objectContaining({resourceUrl: '/admin/apps/my-app-handle'}),
    )
  })

  test("renders a <PreviewLink/> without a resource url if the surface has not been set to 'admin'", () => {
    const appState = {
      app: {url: 'mock.url', title: 'Mock App Title', handle: 'my-app-handle'},
    }
    render(<AppHomeRow />, withProviders(DefaultProviders), {
      state: appState,
      client: {options: {surface: 'checkout'}},
    })

    expect(PreviewLinkMock).toHaveBeenLastCalledWith(expect.objectContaining({resourceUrl: undefined}))
  })
})
