import {ExtensionPayload, useExtensionServerContext} from '@shopify/ui-extensions-server-kit';

export function useDevConsoleInternal() {
  const extensionServer = useExtensionServerContext();

  return {
    ...extensionServer,
    host: extensionServer.client?.connection?.url ?? '',

    // update events
    hide: (extensions: ExtensionPayload[]) =>
      extensionServer.client?.persist('update', {
        extensions: extensions.map((extension) => ({
          uuid: extension.uuid,
          development: {hidden: true},
        })),
      }),
    show: (extensions: ExtensionPayload[]) =>
      extensionServer.client?.persist('update', {
        extensions: extensions.map((extension) => ({
          uuid: extension.uuid,
          development: {hidden: false},
        })),
      }),

    // dispatch events
    refresh: (extensions: ExtensionPayload[]) =>
      extensionServer.client?.emit(
        'refresh',
        extensions.map(({uuid}) => ({uuid})),
      ),
    focus: (extension: ExtensionPayload) =>
      extensionServer.client?.emit('focus', [{uuid: extension.uuid}]),
    unfocus: () => extensionServer.client?.emit('unfocus'),
  };
}
