import type {ResourceURL} from '../types'

export function resourceURLtoString(resource: ResourceURL) {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const url = new URL(resource.url)
  url.searchParams.set('lastUpdated', String(resource.lastUpdated))
  return url.toString()
}
