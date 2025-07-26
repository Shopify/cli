import {removeTrailingSlash} from './common.js'

export function prependApplicationUrl(url: string, applicationUrl: string | undefined): string {
  if (!applicationUrl || !url.startsWith('/')) {
    return url
  }

  return `${removeTrailingSlash(applicationUrl)}${url}`
}
