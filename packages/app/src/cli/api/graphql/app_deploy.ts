import {gql} from 'graphql-request'

export const AppDeploy = gql`
  mutation AppDeploy(
    $apiKey: String!
    $uuid: String!
    $bundleUrl: String
    $appModules: [AppModuleSettings!]
    $skipPublish: Boolean
    $message: String
    $versionTag: String
  ) {
    appDeploy(
      input: {
        apiKey: $apiKey
        uuid: $uuid
        bundleUrl: $bundleUrl
        appModules: $appModules
        skipPublish: $skipPublish
        message: $message
        versionTag: $versionTag
      }
    ) {
      deployment {
        uuid
        id
        message
        versionTag
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
  uuid: string
  config: string
  context: string
}

export interface AppDeployVariables {
  apiKey: string
  uuid: string
  bundleUrl?: string
  appModules?: AppModuleSettings[]
  skipPublish?: boolean
  message?: string
  versionTag?: string
}

interface ErrorDetail {
  extension_id: number
  extension_title: string
}

export interface AppDeploySchema {
  appDeploy: {
    deployment: {
      uuid: string
      id: number
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
      field: string[]
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
