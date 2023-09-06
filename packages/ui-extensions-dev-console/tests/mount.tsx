import React, {useMemo} from 'react'
import {createMount} from '@shopify/react-testing'
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
    const i18nManager = useMemo(
      () =>
        new I18nManager({
          locale,
          onError(err) {
            // eslint-disable-next-line no-console
            console.log(err)
          },
        }),
      [],
    )

    return (
      <I18nContext.Provider value={i18nManager}>
        <DevServerContext.Provider value={context.console}>{element}</DevServerContext.Provider>
      </I18nContext.Provider>
    )
  },
})
