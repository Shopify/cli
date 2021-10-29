import type {ExtensionServerState} from '../state';

export interface ExtensionServerContext {
  client: ExtensionServer.Client;
  state: ExtensionServerState;
  connect(options?: ExtensionServer.Options): void;
}

export interface ExtensionServerProviderProps {
  children: React.ReactNode;
  options: ExtensionServer.Options;
}
