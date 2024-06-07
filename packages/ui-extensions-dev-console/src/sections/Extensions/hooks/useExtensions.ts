import {useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import {useMemo} from 'react'

export function useExtensions() {
  const extensionServer = useExtensionServerContext()

  return useMemo(
    () =>
      extensionServer.state.extensions.map(({uuid, type, extensionPoints}) => ({
        uuid,
        type,
        extensionPoints,
      })),
    [extensionServer.state.extensions.length],
  )
}
