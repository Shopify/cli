import {UserError} from '../../utilities/developer-platform-client.js'

export interface AppModuleSettings {
  uid?: string
  uuid?: string
  specificationIdentifier: string
  config: string
  context: string
  handle: string
}

export interface AppDeployVariables {
  apiKey: string
  bundleUrl?: string
  appModules?: AppModuleSettings[]
  skipPublish?: boolean
  message?: string
  versionTag?: string
  commitReference?: string
}

export interface AppDeploySchema {
  appDeploy: {
    appVersion?: {
      uuid: string
      id: number
      versionTag?: string | null
      location: string
      message?: string | null
      appModuleVersions: {
        uuid: string
        registrationUuid: string
        validationErrors: {
          field: string[]
          message: string
        }[]
      }[]
    }
    userErrors: UserError[]
  }
}
