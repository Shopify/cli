import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const ReleaseVersionMutation = gql`
  mutation ReleaseVersion($appId: ID!, $versionId: ID!) {
    versionRelease(appId: $appId, versionId: $versionId) {
      release {
        version {
          versionTag
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
  versionRelease: {
    release: {
      version: {
        versionTag: string
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
