import React from 'react'
import '@shopify/polaris/dist/styles.css'
import enTranslations from '@shopify/polaris/locales/en.json'
import {AppProvider} from '@shopify/polaris'
import {I18nContext, I18nManager} from '@shopify/react-i18n'
import {ExtensionServerProvider, isValidSurface} from '@shopify/ui-extensions-server-kit'
import {Layout} from '@/foundation/Layout'
import {Routes} from '@/foundation/Routes'
import {Toast} from '@/foundation/Toast'
import {Theme} from '@/foundation/Theme'

function getConnectionUrl() {
  if (import.meta.env.VITE_CONNECTION_URL) {
    return import.meta.env.VITE_CONNECTION_URL.replace('https', 'wss').replace('/dev-console', '')
  }

  const protocol = location.protocol === 'http:' ? 'ws:' : 'wss:'

  return `${protocol}//${location.host}/extensions`
}

const surface = new URLSearchParams(location.search).get('surface')
const extensionServerOptions = {
  connection: {
    url: getConnectionUrl(),
  },
  surface: isValidSurface(surface) ? surface : undefined,
}

const i18nManager = new I18nManager({
  locale: 'en',
  onError(error) {
    // eslint-disable-next-line no-console
    console.log(error)
  },
})

function App() {
  return (
    <ExtensionServerProvider options={extensionServerOptions}>
      <I18nContext.Provider value={i18nManager}>
        <AppProvider i18n={enTranslations}>
          <Theme>
            <Layout>
              <Routes />
              <Toast />
            </Layout>
          </Theme>
        </AppProvider>
      </I18nContext.Provider>
    </ExtensionServerProvider>
  )
}

export default App
