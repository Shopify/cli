import React from 'react'
import {I18nContext, I18nManager} from '@shopify/react-i18n'
import {ExtensionServerProvider, isValidSurface} from '@shopify/ui-extensions-server-kit'
import {Layout} from '@/foundation/Layout'
import {Routes} from '@/foundation/Routes'
import {Toast} from '@/foundation/Toast'
import {Theme} from '@/foundation/Theme'
import {ModalContainer} from '@/foundation/ModalContainer'

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
    console.error(error)
  },
})

function App() {
  return (
    <ExtensionServerProvider options={extensionServerOptions}>
      <I18nContext.Provider value={i18nManager}>
        <Theme>
          <Layout>
            <Routes />
            <Toast />
            <ModalContainer />
          </Layout>
        </Theme>
      </I18nContext.Provider>
    </ExtensionServerProvider>
  )
}

export default App
