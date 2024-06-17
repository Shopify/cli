import {gql} from 'graphql-request'

export const CreateAssetURLMutation = gql`
  mutation CreateAssetURL {
    appRequestSourceUploadUrl {
      sourceUploadUrl
      userErrors {
        field
        message
      }
    }
  }
`

export interface CreateAssetURLMutationSchema {
  appRequestSourceUploadUrl: {
    sourceUploadUrl: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
