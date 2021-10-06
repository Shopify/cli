import {App, ConsoleAction, ExtensionPayload, DevServerUpdateCall} from '../types';

export interface Console {
  app?: App;
  extensions: ExtensionPayload[];
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
