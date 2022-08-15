import {ExtensionPayload, Status} from '../types'

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

let id = 0

function pad(num: number) {
  return `00000000000${num}`.slice(-12)
}

export function mockExtension(obj: DeepPartial<ExtensionPayload> = {}): ExtensionPayload {
  const uuid = `00000000-0000-0000-0000-${pad(id++)}`
  const lastUpdated = Date.now()
  return {
    title: 'My extension',
    surface: 'admin',
    type: 'purchase_option',
    externalType: 'external_type',
    uuid,
    version: 'extension version',
    ...obj,
    assets: {
      main: {
        name: 'main',
        url: `https://secure-link.com/extensions/${uuid}/assets/main.js?lastUpdated=${lastUpdated}`,
        lastUpdated,
      },
      ...((obj.assets || {}) as any),
    } as any,
    development: {
      hidden: false,
      status: Status.Success,
      resource: {
        url: 'resourceUrl',
      },
      root: {
        url: `https://secure-link.com/extensions/${uuid}`,
      },
      renderer: {
        name: 'render name',
        version: '1.0.0',
      },
      ...((obj.development || {}) as any),
    },
  }
}

export function mockExtensions(): ExtensionPayload[] {
  return [mockExtension()]
}
