import {gql} from 'graphql-request'

export const CreateDeployment = gql`
  mutation CreateDeployment($apiKey: String!, $uuid: String!, $bundleUrl: String!, $extensions: [ExtensionSettings!]!) {
    deploymentCreate(input: {apiKey: $apiKey, uuid: $uuid, bundleUrl: $bundleUrl, extensions: $extensions}) {
      deployment {
        uuid
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
  bundleUrl: string
  extensions: ExtensionSettings[]
}

export interface CreateDeploymentSchema {
  deploymentCreate: {
    deployment: {
      uuid: string
      deployedVersions: {
        extensionVersion: {
          uuid: string
          registrationUuid: string
          validationErrors: {
            field: string
            message: string
          }[]
        }
      }[]
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
