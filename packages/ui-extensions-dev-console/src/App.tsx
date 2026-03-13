import {Layout} from '@/foundation/Layout'
import {Routes} from '@/foundation/Routes'
import {Toast} from '@/foundation/Toast'
import {Theme} from '@/foundation/Theme'
import {ModalContainer} from '@/foundation/ModalContainer'
import {ExtensionServerProvider, isValidSurface} from '@shopify/ui-extensions-server-kit'
import React from 'react'

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

function App() {
  return (
    <ExtensionServerProvider options={extensionServerOptions}>
      <Theme>
        <Layout>
          <Routes />
          <Toast />
          <ModalContainer />
        </Layout>
      </Theme>
    </ExtensionServerProvider>
  )
}

export default App
