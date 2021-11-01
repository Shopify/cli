import {DevServerContext, ExtensionPayload, useDevConsole} from '@shopify/ui-extensions-server-kit';
import {useContext} from 'react';

export function useDevConsoleInternal() {
  const devServer = useDevConsole();
  const {host} = useContext(DevServerContext);
  const {dispatch, update} = devServer;

  return {
    ...devServer,
    host,

    // update events
    hide: (extensions: ExtensionPayload[]) =>
      update({
        extensions: extensions.map((extension) => ({
          uuid: extension.uuid,
          development: {hidden: true},
        })),
      }),
    show: (extensions: ExtensionPayload[]) =>
      update({
        extensions: extensions.map((extension) => ({
          uuid: extension.uuid,
          development: {hidden: false},
        })),
      }),

    // dispatch events
    refresh: (extensions: ExtensionPayload[]) =>
      dispatch({type: 'refresh', payload: extensions.map(({uuid}) => ({uuid}))}),
    focus: (extension: ExtensionPayload) =>
      dispatch({type: 'focus', payload: [{uuid: extension.uuid}]}),
    unfocus: () => dispatch({type: 'unfocus'}),
  };
}
