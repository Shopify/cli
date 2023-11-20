import {gql} from 'graphql-request'

export const DevSessionCreateMutation = gql`
  mutation DevSessionCreate($apiKey: String!) {
    devSessionCreate(apiKey: $apiKey) {
      success
      userErrors {
        code
        message
      }
    }
  }
`

export interface DevSessionCreateVariables {
  apiKey: string
}

export interface DevSessionCreateSchema {
  devSessionCreate: {
    success: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
