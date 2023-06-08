import {gql} from 'graphql-request'

export const AppRelease = gql`
  mutation AppRelease($apiKey: String!, $appVersionId: ID) {
    appRelease(input: {apiKey: $apiKey, appVersionId: $appVersionId}) {
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
