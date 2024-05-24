import {gql} from 'graphql-request'

export const CreateAssetURLMutation = gql`
  mutation CreateAssetURL($appId: ID!) {
    assetUrlCreate(appId: $appId) {
      assetUrl
      userErrors {
        field
        message
      }
    }
  }
`

export interface CreateAssetURLMutationVariables {
  appId: string
}

export interface CreateAssetURLMutationSchema {
  assetUrlCreate: {
    assetUrl: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
