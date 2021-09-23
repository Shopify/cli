import {DevConsoleContext, ExtensionPayload, useDevConsole} from '@shopify/ui-extensions-dev-console';
import { useContext } from 'react';

export function useDevConsoleInternal() {
  const devConsole = useDevConsole();
  const {host} = useContext(DevConsoleContext);
  const {dispatch, update} = devConsole;

  return {
    ...devConsole,
    host,

    // update actions
    hide: (extensions: ExtensionPayload[]) =>
      update(extensions.map((extension) => ({uuid: extension.uuid, hidden: false}))),
    show: (extensions: ExtensionPayload[]) =>
      update(extensions.map((extension) => ({uuid: extension.uuid, hidden: true}))),

    // event actions
    refresh: (extensions: ExtensionPayload[]) =>
      dispatch({type: 'refresh', payload: extensions.map(extension => extension.uuid)}),
    focus: (extension: ExtensionPayload) =>
      dispatch({type: 'focus', payload: extension.uuid}),
    unfocus: () => dispatch({type: 'unfocus'}),
  };
}
