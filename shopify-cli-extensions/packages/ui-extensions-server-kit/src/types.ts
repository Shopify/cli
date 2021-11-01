/* eslint-disable @typescript-eslint/no-namespace, @shopify/strict-component-boundaries */
import './ExtensionServerClient/types';

declare global {
  namespace ExtensionServer {
    interface InboundEvents {
      connected: {extensions?: ExtensionPayload[]; app?: App};
      update: {extensions?: ExtensionPayload[]; app?: App};
      refresh: {uuid: string}[];
      focus: {uuid: string}[];
      unfocus: void;
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
    }
  }
}

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export interface ExtensionPayload {
  type: string;
  assets: {[name: string]: {name: string; url: string}};
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
