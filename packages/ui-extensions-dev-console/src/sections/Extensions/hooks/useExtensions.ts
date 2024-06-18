import {useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import {useMemo} from 'react'

export function useExtensions() {
  const extensionServer = useExtensionServerContext()

  return useMemo(
    () =>
      extensionServer.state.extensions
        .sort((aExtension, bExtension) => {
          if (aExtension.type.toLowerCase() === 'app_home') {
            // aExtension will come first
            return -1
          }
          return aExtension.handle.localeCompare(bExtension.handle)
        })
        .map(({uuid, type}) => ({
          uuid,
          type,
        })),
    [extensionServer.state.extensions.length],
  )
}
