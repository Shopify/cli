import React from 'react'
import {I18nContext, I18nManager} from '@shopify/react-i18n'

export function MockI18nProvider({children}: React.PropsWithChildren<{[key: string]: unknown}>) {
  // eslint-disable-next-line react/jsx-no-constructed-context-values
  const i18nManager = new I18nManager({
    locale: 'en',
    onError(error) {
      // eslint-disable-next-line no-console
      console.log(error)
    },
  })

  return <I18nContext.Provider value={i18nManager}>{children}</I18nContext.Provider>
}
