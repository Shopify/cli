import {useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import {useMemo} from 'react'

export function useExtension(uuid: string) {
  const extensionServer = useExtensionServerContext()
  const extensions = extensionServer.state.extensions
  const extension = extensions.find((extension) => extension.uuid === uuid)

  return useMemo(
    () => ({
      extension,
      // dispatch events
      focus: () => extensionServer.client.emit('focus', [{uuid}]),
      unfocus: () => extensionServer.client.emit('unfocus'),
      navigate: (url: string) => extensionServer.client.emit('navigate', {url}),
    }),
    [JSON.stringify(extensions)],
  )
}
