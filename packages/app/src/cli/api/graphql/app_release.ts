import {gql} from 'graphql-request'

export const AppRelease = gql`
  mutation AppRelease($apiKey: String!, $deploymentId: ID, $versionTag: String) {
    appRelease(input: {apiKey: $apiKey, deploymentId: $deploymentId, versionTag: $versionTag}) {
      deployment {
        versionTag
        message
        location
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

interface ErrorDetail {
  extension_id: number
  extension_title: string
}

export interface AppReleaseVariables {
  apiKey: string
  versionTag?: string
  deploymentId?: number
}

export interface AppReleaseSchema {
  appRelease: {
    deployment: {
      versionTag: string
      message: string
      location: string
    }
    userErrors: {
      field: string[]
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
