type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export interface DevServerUpdateCall {
  event: 'update';
  data: {
    extensions?: ({uuid: string} & DeepPartial<ExtensionPayload>)[];
    app?: DeepPartial<App>;
  };
}

export type DevServerCall =
  | {
      event: 'update';
      data: {
        extensions?: ({uuid: string} & DeepPartial<ExtensionPayload>)[];
        app?: DeepPartial<App>;
      };
    }
  | {
      event: 'dispatch';
      data: ConsoleAction;
    };

export interface DevServerUpdateResponse {
  event: 'update' | 'connected';
  data: {extensions?: ExtensionPayload[]; app?: App};
}

export type DevServerResponse =
  | {
      event: 'update' | 'connected';
      data: {extensions?: ExtensionPayload[]; app?: App};
    }
  | {
      event: 'dispatch';
      data: ConsoleAction;
    };

export type ConsoleAction =
  | Action<'refresh', string[]>
  | Action<'focus', string>
  | BaseAction<'unfocus'>;

export interface BaseAction<T extends string> {
  type: T;
}
// @shopify/eslint-plugins doesn't allow any generic other than T
// If this becomes a problem, consider modifying this rule
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface Action<T extends string = string, P = any> {
  type: T;
  payload: P;
}

export interface ExtensionPayload {
  type: string;
  assets: {[name: string]: {name: string; url: string}};
  development: {
    hidden: boolean;
    status: Status;
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
