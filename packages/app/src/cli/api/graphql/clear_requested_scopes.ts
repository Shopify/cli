import {gql} from 'graphql-request'

export const clearRequestedScopes = gql`
  mutation appRequestedAccessScopesClear($apiKey: String!) {
    appRequestedAccessScopesClear(input: {apiKey: $apiKey}) {
      userErrors {
        message
        field
      }
    }
  }
`

export interface ClearScopesVariables {
  apiKey: string
}

export interface ClearScopesSchema {
  appRequestedAccessScopesClear: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
