import {useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import {useMemo} from 'react'

export function useExtensionServerOptions() {
  const extensionServer = useExtensionServerContext()
  const options = extensionServer.client.options

  return useMemo(() => options, [JSON.stringify(options)])
}
