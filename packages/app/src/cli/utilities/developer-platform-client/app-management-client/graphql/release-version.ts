import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const ReleaseVersionMutation = gql`
  mutation ReleaseVersion($appId: ID!, $versionId: ID!) {
    appReleaseCreate(appId: $appId, versionId: $versionId) {
      release {
        version {
          id
          metadata {
            message
            versionTag
          }
        }
      }
      userErrors {
        field
        message
        category
        code
        on
      }
    }
  }
`

export interface ReleaseVersionMutationVariables {
  appId: string
  versionId: string
}

export interface ReleaseVersionMutationSchema {
  appReleaseCreate: {
    release: {
      version: {
        id: string
        metadata: {
          message: string
          versionTag: string
        }
      }
    }
    userErrors: {
      field: string[]
      message: string
      category: string
      code: string
      on: JsonMapType
    }[]
  }
}
