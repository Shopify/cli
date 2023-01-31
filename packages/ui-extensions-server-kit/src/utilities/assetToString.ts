import type {Asset} from '../types'

export function assetToString(asset: Asset) {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const url = new URL(asset.url)
  url.searchParams.set('lastUpdated', String(asset.lastUpdated))
  return url.toString()
}
