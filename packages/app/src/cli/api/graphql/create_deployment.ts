import {gql} from 'graphql-request'

export const CreateDeployment = gql`
  mutation CreateDeployment($apiKey: String!, $uuid: String!, $bundleUrl: String, $extensions: [ExtensionSettings!]) {
    deploymentCreate(input: {apiKey: $apiKey, uuid: $uuid, bundleUrl: $bundleUrl, extensions: $extensions}) {
      deployment {
        uuid
        id
        deployedVersions {
          extensionVersion {
            uuid
            registrationUuid
            validationErrors {
              message
              field
            }
          }
        }
      }
      userErrors {
        message
        field
        details
        category
      }
    }
  }
`

export interface ExtensionSettings {
  uuid: string
  config: string
  context: string
}

export interface CreateDeploymentVariables {
  apiKey: string
  uuid: string
  bundleUrl?: string
  extensions?: ExtensionSettings[]
}

interface ErrorDetail {
  extension_id: number
  extension_title: string
}

export interface CreateDeploymentSchema {
  deploymentCreate: {
    deployment: {
      uuid: string
      id: number
      deployedVersions: {
        extensionVersion: {
          uuid: string
          registrationUuid: string
          validationErrors: {
            field: string[]
            message: string
          }[]
        }
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
