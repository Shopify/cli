import {Web, WebType} from '../../../models/app/app.js'
import {isWebType} from '../../../models/app/loader.js'

export function frontAndBackendConfig(webs: Web[]) {
  const frontendConfig = webs.find((web) => isWebType(web, WebType.Frontend))
  const backendConfig = webs.find((web) => isWebType(web, WebType.Backend))
  return {frontendConfig, backendConfig}
}

export interface UnknownObject {
  [key: string]: {[key: string]: string} | string | undefined
}

export function flattenObject(obj: UnknownObject) {
  const result: UnknownObject = {}

  function recurse(current: UnknownObject, path = '') {
    for (const key in current) {
      if (key) {
        const value = current[key]
        const newPath = path ? `${path}.${key}` : key

        if (value && typeof value === 'object') {
          recurse(value, newPath)
        } else {
          result[newPath] = value
        }
      }
    }
  }

  recurse(obj)

  return result
}
