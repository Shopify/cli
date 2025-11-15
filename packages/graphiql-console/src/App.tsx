import {GraphiQLSection} from './sections/GraphiQL/index.ts'

import React from 'react'

import {AppProvider} from '@shopify/polaris'
import '@shopify/polaris/build/esm/styles.css'
import 'graphiql/style.css'
import 'graphiql/setup-workers/vite'

function App() {
  return (
    <AppProvider i18n={{}}>
      <GraphiQLSection />
    </AppProvider>
  )
}

export default App
