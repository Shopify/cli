import {ConsoleAction, ExtensionPayload} from '../types';

export interface Console {
  extensions: ExtensionPayload[];
  update(
    extensions: ({uuid: string} & Partial<ExtensionPayload>)[],
  ): void;
  dispatch(acion: ConsoleAction): void;
}

export interface ConsoleState {
  extensions: ExtensionPayload[];
}

export interface Listener {
  (action: ConsoleAction): void;
}
