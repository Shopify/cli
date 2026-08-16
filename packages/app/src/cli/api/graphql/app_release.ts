import {UserError} from '../../utilities/developer-platform-client.js'

export interface AppReleaseSchema {
  appRelease: {
    appVersion?: {
      versionTag?: string | null
      message?: string | null
      location: string
    }
    userErrors?: UserError[]
  }
}
