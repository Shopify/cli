import {CheckoutExtensionPlacementReference, useExtensionServerContext} from '@shopify/ui-extensions-server-kit'
import {useMemo} from 'react'

export interface ExtensionSettings {
  placementReference: CheckoutExtensionPlacementReference
}

export function useExtension(uuid: string) {
  const extensionServer = useExtensionServerContext()
  const extensions = extensionServer.state.extensions
  const extension = extensions.find((extension) => extension.uuid === uuid)

  return useMemo(
    () => ({
      extension,
      setSettings: (settings: ExtensionSettings) => {
        extensionServer.client.persist('update', {
          extensions: extensions.map((extension) => ({
            uuid: extension.uuid,
            development: {
              placementReference:
                extension.uuid === uuid ? settings.placementReference : extension.development.placementReference,
            },
          })),
        })
      },
      hide: () =>
        extensionServer.client.persist('update', {
          extensions: extensions.map((extension) => ({
            uuid: extension.uuid,
            development: {hidden: extension.uuid === uuid ? true : extension.development.hidden},
          })),
        }),
      show: () =>
        extensionServer.client.persist('update', {
          extensions: extensions.map((extension) => ({
            uuid: extension.uuid,
            development: {hidden: extension.uuid === uuid ? false : extension.development.hidden},
          })),
        }),

      // dispatch events
      focus: () => extensionServer.client.emit('focus', [{uuid}]),
      unfocus: () => extensionServer.client.emit('unfocus'),
      navigate: (url: string) => extensionServer.client.emit('navigate', {url}),
    }),
    [JSON.stringify(extensions)],
  )
}
