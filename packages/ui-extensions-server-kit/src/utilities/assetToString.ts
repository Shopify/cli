import type {Asset} from '../types'

export function assetToString(asset: Asset) {
  const url = new URL(asset.url)
  url.searchParams.set('lastUpdated', String(asset.lastUpdated))
  return url.toString()
}
