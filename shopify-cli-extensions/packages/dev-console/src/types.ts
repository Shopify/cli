type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type DevServerCall = {
  event: 'update';
  data: ({uuid: string} & DeepPartial<ExtensionPayload>)[];
} | {
  event: 'dispatch'; 
  data: ConsoleAction;
}

export type DevServerResponse = {
  event: 'update' | 'connected';
  data: {extensions?: ExtensionPayload[]; app?: App};
} | {
  event: 'dispatch';
  data: ConsoleAction;
}

export type ConsoleAction = Action<'refresh', string[]> | Action<'focus', string> | BaseAction<'unfocus'>;

export interface BaseAction<T extends string> {
  type: T
}
export interface Action<T extends string = string, P = never> {
  type: T;
  payload: P;
}

export interface ExtensionPayload {
  type: string;
  assets: {name: string; url: string;}[];
  development: {
    hidden: boolean;
    status: Status;
    resource: {
      url: string;
    };
    renderer: {
      name: string;
      version: string;
    }
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
