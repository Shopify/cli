import {ExtensionPayload, useDevConsole} from '@/dev-console-utils';

export function useDevConsoleInternal() {
  const devConsole = useDevConsole();
  const {dispatch, update} = devConsole;

  return {
    ...devConsole,

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
