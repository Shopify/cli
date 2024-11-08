import {gql} from 'graphql-request'

export const AppRelease = gql`
  mutation AppRelease($apiKey: String!, $appVersionId: ID, $versionTag: String) {
    appRelease(input: {apiKey: $apiKey, appVersionId: $appVersionId, versionTag: $versionTag}) {
      appVersion {
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
  appVersionId?: number
}

export interface AppReleaseSchema {
  appRelease: {
    appVersion: {
      versionTag?: string | null
      message?: string | null
      location: string
    }
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
