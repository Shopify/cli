import {gql} from 'graphql-request'

export const UpdateURLsQuery = gql`
  mutation appUpdate($apiKey: String!, $applicationUrl: Url!, $redirectUrlWhitelist: [Url]!) {
    appUpdate(input: {apiKey: $apiKey, applicationUrl: $applicationUrl, redirectUrlWhitelist: $redirectUrlWhitelist}) {
      userErrors {
        message
        field
      }
    }
  }
`

export interface UpdateURLsQueryVariables {
  apiKey: string
  applicationUrl: string
  redirectUrlWhitelist: string[]
}

export interface UpdateURLsQuerySchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
