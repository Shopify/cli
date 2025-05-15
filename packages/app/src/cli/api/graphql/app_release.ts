import {UserError} from '../../utilities/developer-platform-client.js'
import {gql} from 'graphql-request'
// eslint-disable-next-line @shopify/cli/no-inline-graphql
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

export interface AppReleaseVariables {
  apiKey: string
  versionTag?: string
  appVersionId?: number
}

export interface AppReleaseSchema {
  appRelease: {
    appVersion?: {
      versionTag?: string | null
      message?: string | null
      location: string
    }
    userErrors?: UserError[]
  }
}
