import {App, ConsoleAction, ExtensionPayload} from '../types';

export interface Console {
  state: ConsoleState;
  update(
    extensions: ({uuid: string} & Partial<ExtensionPayload>)[],
  ): void;
  dispatch(acion: ConsoleAction): void;
}

export interface ConsoleState {
  app?: App;
  extensions: ExtensionPayload[];
}

export interface Listener {
  (action: ConsoleAction): void;
}
