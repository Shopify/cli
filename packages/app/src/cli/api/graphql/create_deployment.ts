import {gql} from 'graphql-request'

export const CreateDeployment = gql`
  mutation CreateDeployment(
    $apiKey: String!
    $uuid: String!
    $bundleUrl: String
    $extensions: [ExtensionSettings!]
    $label: String
  ) {
    deploymentCreate(
      input: {apiKey: $apiKey, uuid: $uuid, bundleUrl: $bundleUrl, extensions: $extensions, label: $label}
    ) {
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
  label?: string
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
    }[]
  }
}
