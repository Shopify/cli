import {gql} from 'graphql-request'

export const DevelopmentStorePreviewUpdateQuery = gql`
  mutation DevelopmentStorePreviewUpdate($input: DevelopmentStorePreviewUpdateInput!) {
    developmentStorePreviewUpdate(input: $input) {
      app {
        id
        developmentStorePreviewEnabled
      }
      userErrors {
        message
        field
      }
    }
  }
`

export interface DevelopmentStorePreviewUpdateInput {
  input: {
    apiKey: string
    enabled: boolean
  }
}

export interface DevelopmentStorePreviewUpdateSchema {
  developmentStorePreviewUpdate: {
    app: {
      id: string
      developmentStorePreviewEnabled: boolean
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
