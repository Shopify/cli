import React from 'react'
import {createMount} from '@shopify/react-testing'
import enTranslations from '@shopify/polaris/locales/en.json'
import {AppProvider} from '@shopify/polaris'
import {I18nContext, I18nManager} from '@shopify/react-i18n'
import {DevServerContext, DevServerContextValue} from '@shopify/ui-extensions-server-kit'
import {mockApp, mockExtensions} from '@shopify/ui-extensions-server-kit/testing'

interface MountOptions {
  console?: Partial<DevServerContextValue>
}
interface Context {
  console: DevServerContextValue
}

export const mount = createMount<MountOptions, Context>({
  context(options) {
    const context = {
      console: {
        host: 'www.example-host.com:8000/extensions/',
        app: options.console && 'app' in options.console ? options.console.app : mockApp(),
        store: options.console?.store ?? '',
        extensions: options.console?.extensions ?? mockExtensions(),
        send: options.console?.send ?? jest.fn(),
        addListener: options.console?.addListener ?? jest.fn(),
      },
    }
    return context
  },
  render(element, context) {
    const locale = 'en'
    // eslint-disable-next-line react/jsx-no-constructed-context-values
    const i18nManager = new I18nManager({
      locale,
      onError(error) {
        // eslint-disable-next-line no-console
        console.log(error)
      },
    })

    return (
      <I18nContext.Provider value={i18nManager}>
        <AppProvider i18n={enTranslations}>
          <DevServerContext.Provider value={context.console}>{element}</DevServerContext.Provider>
        </AppProvider>
      </I18nContext.Provider>
    )
  },
})
