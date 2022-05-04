import {gql} from 'graphql-request'

export const CreateDeployment = gql`
  mutation CreateDeployment($apiKey: String!, $uuid: String!, $bundleUrl: String!) {
    deploymentCreate(input: {apiKey: $apiKey, uuid: $uuid, bundleUrl: $bundleUrl}) {
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

export interface CreateDeploymentVariables {
  apiKey: string
  uuid: string
  bundleUrl: string
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
