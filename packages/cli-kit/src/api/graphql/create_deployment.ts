import {gql} from 'graphql-request'

export const CreateDeployment = gql`
  mutation CreateDeployment($apiKey: String!, $uuid: String!, $bundleUrl: String!, $extensions: [ExtensionSettings!]) {
    deploymentCreate(input: {apiKey: $apiKey, uuid: $uuid, bundleUrl: $bundleUrl, extensions: $extensions}) {
      deployment {
        uuid
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
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
