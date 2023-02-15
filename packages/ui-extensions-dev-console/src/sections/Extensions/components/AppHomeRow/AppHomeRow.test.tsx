import {AppHomeRow} from '.'
import en from './translations/en.json'
import {PreviewLink, QRCodeModal} from '..'
import React from 'react'

import {DefaultProviders} from 'tests/DefaultProviders'
import {mockI18n} from 'tests/mock-i18n'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {Button} from '@/components'

vi.mock('..', () => ({
  NotApplicable: () => null,
  PreviewLink: () => null,
  QRCodeModal: () => null,
  Row: (props: any) => props.children,
}))

vi.mock('@/components', () => ({
  Button: (props: any) => props.children,
}))

mockI18n(en)

describe('<AppHomeRow/>', () => {
  const defaultState = {
    app: {url: 'mock.url', title: 'Mock App Title'},
  }

  test('renders a <QRCodeModal/>, closed by default', () => {
    const container = render(<AppHomeRow />, withProviders(DefaultProviders), {state: defaultState})

    expect(container).toContainReactComponent(QRCodeModal, {code: undefined})
  })

  test('Opens and closes the <QRCodeModal/> ', () => {
    const container = render(<AppHomeRow />, withProviders(DefaultProviders), {state: defaultState})

    container.act(() => {
      container.find(Button)?.trigger('onClick')
    })

    expect(container).toContainReactComponent(QRCodeModal, {
      code: {
        url: defaultState.app.url,
        type: 'home',
        title: defaultState.app.title,
      },
    })

    container.act(() => {
      container.find(QRCodeModal)?.trigger('onClose')
    })

    expect(container).toContainReactComponent(QRCodeModal, {code: undefined})
  })

  test("renders a <PreviewLink/> with the resource url set to the app's handle if the surface has been set to 'admin'", () => {
    const appState = {
      app: {url: 'mock.url', title: 'Mock App Title', handle: 'my-app-handle'},
    }
    const container = render(<AppHomeRow />, withProviders(DefaultProviders), {
      state: appState,
      client: {options: {surface: 'admin'}},
    })

    expect(container).toContainReactComponent(PreviewLink, {resourceUrl: '/admin/apps/my-app-handle'})
  })

  test("renders a <PreviewLink/> without a resource url if the surface has not been set to 'admin'", () => {
    const appState = {
      app: {url: 'mock.url', title: 'Mock App Title', handle: 'my-app-handle'},
    }
    const container = render(<AppHomeRow />, withProviders(DefaultProviders), {
      state: appState,
      client: {options: {surface: 'checkout'}},
    })

    expect(container).toContainReactComponent(PreviewLink, {resourceUrl: undefined})
  })
})
