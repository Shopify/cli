import * as styles from './theme.module.css'
import React from 'react'
import '@shopify/polaris/dist/styles.css'
import enTranslations from '@shopify/polaris/locales/en.json'
import {AppProvider} from '@shopify/polaris'
import {I18nContext, I18nManager} from '@shopify/react-i18n'
import {ExtensionServerProvider, isValidSurface} from '@shopify/ui-extensions-server-kit'
import {ToastContainer} from 'react-toastify'
import Layout from '@/Layout/Layout'
import Routes from '@/Routes'
import 'react-toastify/dist/ReactToastify.css'

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

const locale = 'en'
const i18nManager = new I18nManager({
  locale,
  onError(error) {
    // eslint-disable-next-line no-console
    console.log(error)
  },
})

function App() {
  return (
    <div className={styles.Theme}>
      <ExtensionServerProvider options={extensionServerOptions}>
        <I18nContext.Provider value={i18nManager}>
          <AppProvider i18n={enTranslations}>
            <Layout>
              <Routes />
              <ToastContainer
                position="bottom-center"
                theme="dark"
                closeButton={false}
                pauseOnFocusLoss={false}
                closeOnClick
                hideProgressBar
              />
              {/* react-toastify requires exactly this class. */}
              {/* Inlining the style prevents the className from changing */}
              <style>
                {`.Toastify__toast-body {
                  padding-top: 0;
                  padding-bottom: 0;
                }`}
              </style>
            </Layout>
          </AppProvider>
        </I18nContext.Provider>
      </ExtensionServerProvider>
    </div>
  )
}

export default App
