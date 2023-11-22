import {gql} from 'graphql-request'

export const DevSessionDeleteMutation = gql`
  mutation devSessionDelete($apiKey: String!) {
    devSessionDelete(apiKey: $apiKey) {
      success
      userErrors {
        field
        message
      }
    }
  }
`

export interface DevSessionDeleteVariables {
  apiKey: string
}

export interface DevSessionDeleteSchema {
  devSessionDelete: {
    success: string
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
