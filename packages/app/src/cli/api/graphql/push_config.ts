import {gql} from 'graphql-request'

export const AppUpdateQuery = gql`
  mutation appUpdate($apiKey: String!) {
    appUpdate(input: {apiKey: $apiKey}) {
      userErrors {
        message
        field
      }
    }
  }
`
