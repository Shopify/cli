import {gql} from 'graphql-request'

export const ReleaseVersionMutation = gql`
  mutation ReleaseVersion($appId: ID!, $versionId: ID!) {
    versionRelease(appId: $appId, versionId: $versionId) {
      userErrors {
        field
        message
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
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
