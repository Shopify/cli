import {ExtensionPayload, useExtensionServerContext} from '@shopify/ui-extensions-server-kit'

export function useExtensionsInternal() {
  const extensionServer = useExtensionServerContext()
  const embedded = new URLSearchParams(location.search).get('embedded') === 'true'

  return {
    ...extensionServer,
    embedded,
    host: extensionServer.client.connection?.url ?? '',

    // update events
    hide: (extensions: ExtensionPayload[]) =>
      extensionServer.client.persist('update', {
        extensions: extensions.map((extension) => ({
          uuid: extension.uuid,
          development: {hidden: true},
        })),
      }),
    show: (extensions: ExtensionPayload[]) =>
      extensionServer.client.persist('update', {
        extensions: extensions.map((extension) => ({
          uuid: extension.uuid,
          development: {hidden: false},
        })),
      }),

    // dispatch events
    focus: (extension: ExtensionPayload) => extensionServer.client.emit('focus', [{uuid: extension.uuid}]),
    unfocus: () => extensionServer.client.emit('unfocus'),
    navigate: (extension: ExtensionPayload) =>
      extensionServer.client.emit('navigate', {url: extension.development.resource.url}),
  }
}
