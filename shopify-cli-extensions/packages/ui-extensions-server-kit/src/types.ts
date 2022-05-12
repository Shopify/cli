/* eslint-disable @typescript-eslint/no-namespace, @shopify/strict-component-boundaries */
import './ExtensionServerClient/types';
import type {Surface} from './ExtensionServerClient/types';

declare global {
  namespace ExtensionServer {
    interface InboundEvents {
      connected: {extensions: ExtensionPayload[]; app?: App; store: string};
      update: {extensions?: ExtensionPayload[]; app?: App};
      refresh: {uuid: string}[];
      focus: {uuid: string}[];
      unfocus: void;
      navigate: {url: string};
    }

    interface OutboundPersistEvents {
      update: {
        extensions?: ({uuid: string} & DeepPartial<ExtensionPayload>)[];
        app?: DeepPartial<App>;
      };
    }

    interface OutboundDispatchEvents {
      refresh: {uuid: string}[];
      focus: {uuid: string}[];
      unfocus: void;
      navigate: {url: string};
    }
  }
}

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export interface ResourceURL {
  name: string;
  url: string;
  lastUpdated: number;
}

export interface ExtensionPayload {
  type: string;
  assets: {[name: string]: ResourceURL};
  development: {
    hidden: boolean;
    status: Status;
    focused?: boolean;
    resource: {
      url: string;
    };
    root: {
      url: string;
    };
    renderer: {
      name: string;
      version: string;
    };
  };
  uuid: string;
  version: string;
  surface: Surface;
  title: string;
}

export enum Status {
  Error = 'error',
  Success = 'success',
}

export interface App {
  id: string;
  apiKey: string;
  applicationUrl: string;
  handle?: string | null;
  title: string;
  developerName?: string;
  icon: {
    transformedSrc: string;
  };
  installation?: {
    launchUrl: string;
  };
  supportEmail?: string;
  supportLocales?: string[];
}
