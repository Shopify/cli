import {gql} from 'graphql-request'

export const UpdateURLsQuery = gql`
  mutation appUpdate($apiKey: String!, $appUrl: Url!, $redir: [Url]!) {
    appUpdate(input: {apiKey: $apiKey, applicationUrl: $appUrl, redirectUrlWhitelist: $redir}) {
      userErrors {
        message
        field
      }
    }
  }
`

export interface UpdateURLsQueryVariables {
  apiKey: string
  appUrl: string
  redir: string[]
}

export interface UpdateURLsQuerySchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
