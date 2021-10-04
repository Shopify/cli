import {App, ConsoleAction, ExtensionPayload, DevServerUpdateCall} from '../types';

export interface Console {
  state: ConsoleState;
  update(data: DevServerUpdateCall['data']): void;
  dispatch(acion: ConsoleAction): void;
}

export interface ConsoleState {
  app?: App;
  extensions: ExtensionPayload[];
}

export interface Listener {
  (action: ConsoleAction): void;
}
