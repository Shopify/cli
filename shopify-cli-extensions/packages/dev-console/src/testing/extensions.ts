import {ExtensionPayload, Status} from '../types';

let id = 0;

export function mockExtension(obj: Partial<ExtensionPayload> = {}): ExtensionPayload {
  return {
    type: 'purchase_option',
    assets: [{name: 'main', url: 'assetUrl.com'}],
    development: {
      hidden: false,
      status: Status.Success,
      resource: {
        url: 'resourceUrl',
      },
      renderer: {
        name: 'render name',
        version: '1.0.0',
      }
    },
    uuid: `0000-${id++}`,
    version: 'extension version',
    ...obj,
  };
}

export function mockExtensions(): ExtensionPayload[] {
  return [mockExtension()];
}
