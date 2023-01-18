import {useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import {useMemo} from 'react'

export function useApp() {
  const extensionServer = useExtensionServerContext()
  const store = extensionServer.state.store
  const app = extensionServer.state.app

  return useMemo(
    () => ({
      store,
      app,
    }),
    [JSON.stringify(app), store],
  )
}
