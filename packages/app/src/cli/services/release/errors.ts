import {AbortError} from '@shopify/cli-kit/node/error'

export class AppVersionNotFoundError extends AbortError {
  readonly versionTag: string

  constructor(versionTag: string) {
    super(`Version ${versionTag} could not be found.`)
    this.versionTag = versionTag
  }
}
