import React from 'react'

import {AppProvider} from '@shopify/polaris'
import '@shopify/polaris/build/esm/styles.css'

function App() {
  return (
    <AppProvider i18n={{}}>
      <div>GraphiQL Console</div>
    </AppProvider>
  )
}

export default App
