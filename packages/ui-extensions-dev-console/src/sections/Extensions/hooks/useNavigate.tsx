import {useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import {useMemo} from 'react'

export function useNavigate() {
  const extensionServer = useExtensionServerContext()

  return useMemo(() => (url: string) => extensionServer.client.emit('navigate', {url}), [extensionServer.client.emit])
}
