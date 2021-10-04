import {ExtensionPayload, Status} from '../types';

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

let id = 0;

export function mockExtension(obj: DeepPartial<ExtensionPayload> = {}): ExtensionPayload {
  return {
    type: 'purchase_option',
    assets: {
      main: {
        name: 'main',
        url: 'http://localhost:8000/extensions/00000000-0000-0000-0000-000000000001/assets/main.js',
      },
    } as any,
    development: {
      hidden: false,
      status: Status.Success,
      resource: {
        url: 'resourceUrl',
      },
      root: {
        url: 'http://localhost:8000/extensions/00000000-0000-0000-0000-000000000001',
      },
      renderer: {
        name: 'render name',
        version: '1.0.0',
      },
      ...((obj.development || {}) as any),
    },
    uuid: `0000-${id++}`,
    version: 'extension version',
    ...obj,
  };
}

export function mockExtensions(): ExtensionPayload[] {
  return [mockExtension()];
}
