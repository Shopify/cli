import {ExtensionRow} from '.'
import en from './translations/en.json'
import {SettingsModal} from './components/index'
import {QRCodeModal} from '..'
import React from 'react'

import {DefaultProviders} from 'tests/DefaultProviders'
import {mockI18n} from 'tests/mock-i18n'
import {render, withProviders} from '@shopify/ui-extensions-test-utils'
import {mockExtension} from '@shopify/ui-extensions-server-kit/testing'
import {Button} from '@/components'

vi.mock('./components', () => ({
  PreviewLinks: () => null,
  SettingsModal: () => null,
}))

vi.mock('..', () => ({
  QRCodeModal: () => null,
  Row: (props: any) => props.children,
  Status: () => null,
  View: () => null,
}))

mockI18n(en)

describe('<ExtensionRow/>', () => {
  const extension = mockExtension()
  const checkoutExtension = mockExtension({type: 'checkout_ui_extension'})
  const defaultProps = {
    uuid: extension.uuid,
  }
  const defaultState = {
    extensions: [extension],
  }
  const checkoutExtensionProps = {
    uuid: checkoutExtension.uuid,
  }
  const stateWithCheckoutExtension = {
    ...defaultState,
    extensions: [...defaultState.extensions, checkoutExtension],
  }

  test('renders a <QRCodeModal/>, closed by default', () => {
    const container = render(<ExtensionRow {...defaultProps} />, withProviders(DefaultProviders), {state: defaultState})

    expect(container).toContainReactComponent(QRCodeModal, {code: undefined})
  })

  test('Opens and closes the <QRCodeModal/> ', () => {
    const container = render(<ExtensionRow {...defaultProps} />, withProviders(DefaultProviders), {state: defaultState})

    container.act(() => {
      container.find(Button)?.trigger('onClick')
    })

    expect(container).toContainReactComponent(QRCodeModal, {
      code: {
        url: extension.development.root.url,
        type: extension.surface,
        title: extension.title,
      },
    })

    container.act(() => {
      container.find(QRCodeModal)?.trigger('onClose')
    })

    expect(container).toContainReactComponent(QRCodeModal, {code: undefined})
  })

  test('renders a <SettingsModal/> for checkout ui extensions', () => {
    const container = render(<ExtensionRow {...checkoutExtensionProps} />, withProviders(DefaultProviders), {
      state: stateWithCheckoutExtension,
    })

    expect(container).toContainReactComponent(SettingsModal, {open: false})
  })

  test('opens and closes the <SettingsModal/>', () => {
    const container = render(<ExtensionRow {...checkoutExtensionProps} />, withProviders(DefaultProviders), {
      state: stateWithCheckoutExtension,
    })

    container.act(() => {
      container.find(Button, {children: 'Settings'})?.trigger('onClick')
    })

    expect(container).toContainReactComponent(SettingsModal, {open: true})

    container.act(() => {
      container.find(SettingsModal)?.trigger('onClose')
    })

    expect(container).toContainReactComponent(SettingsModal, {open: false})
  })
})
