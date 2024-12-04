import {gql} from 'graphql-request'

export const AppDeploy = gql`
  mutation AppDeploy(
    $apiKey: String!
    $bundleUrl: String
    $appModules: [AppModuleSettings!]
    $skipPublish: Boolean
    $message: String
    $versionTag: String
    $commitReference: String
  ) {
    appDeploy(
      input: {
        apiKey: $apiKey
        bundleUrl: $bundleUrl
        appModules: $appModules
        skipPublish: $skipPublish
        message: $message
        versionTag: $versionTag
        commitReference: $commitReference
      }
    ) {
      appVersion {
        uuid
        id
        message
        versionTag
        location
        appModuleVersions {
          uuid
          registrationUuid
          validationErrors {
            message
            field
          }
        }
      }
      userErrors {
        message
        field
        category
        details
      }
    }
  }
`

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

interface ErrorDetail {
  extension_id: number
  extension_title: string
  specification_identifier: string
}

export interface AppDeploySchema {
  appDeploy: {
    appVersion: {
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
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
