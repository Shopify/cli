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
    },
    approvalScopes: ['read_products'],
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
    // this is due to the naive DeepPartial but also more complex ones
    // [see stackoverflow](https://stackoverflow.com/a/68699273) assume that
    // `DeepPartial<Array<T>> === Array<T | undefined>` while we are looking for
    // `DeepPartial<Array<T>> === Array<T> | undefined`.
    // This is the case for extension points and also categories and seems hard to fix
    // in a generalized, non-surprising way
    extensionPoints: obj.extensionPoints as any,
    categories: obj.categories as any,
    localization: obj.localization as any,
    authenticatedRedirectStartUrl: obj.authenticatedRedirectStartUrl as any,
    authenticatedRedirectRedirectUrls: obj.authenticatedRedirectRedirectUrls as any,
  }
}

export function mockExtensions(): ExtensionPayload[] {
  return [mockExtension()]
}
