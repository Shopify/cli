import {gql} from 'graphql-request'

export const PushConfig = gql`
  mutation appUpdate(
    $apiKey: String!
    $title: String
    $applicationUrl: Url
    $redirectUrlAllowlist: [Url]
    $requestedAccessScopes: [String!]
  ) {
    appUpdate(
      input: {
        apiKey: $apiKey
        title: $title
        applicationUrl: $applicationUrl
        redirectUrlWhitelist: $redirectUrlAllowlist
        requestedAccessScopes: $requestedAccessScopes
      }
    ) {
      userErrors {
        message
        field
      }
    }
  }
`

export interface PushConfigVariables {
  apiKey: string
  applicationUrl: string
  title: string
  redirectUrlAllowlist: string[]
  requestedAccessScopes: string[]
}

export interface PushConfigSchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
