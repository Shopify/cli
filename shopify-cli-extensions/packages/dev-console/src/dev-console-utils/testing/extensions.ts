import {ExtensionPayload, Status} from '@/dev-console-utils';

export function mockExtensions(): ExtensionPayload[] {
  return [
    
    {
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
      uuid: '0001',
      version: 'extension version',
    },
  ];
}
