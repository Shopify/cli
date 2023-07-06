import {gql} from 'graphql-request'

export const deleteAppProxy = gql`
  mutation appProxyDelete($apiKey: String!) {
    appProxyDelete(input: {apiKey: $apiKey}) {
      userErrors {
        message
        field
      }
    }
  }
`

export interface DeleteAppProxyVariables {
  apiKey: string
}

export interface DeleteAppProxySchema {
  userErrors: {
    field: string[]
    message: string
  }[]
}
