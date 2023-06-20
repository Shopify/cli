import {gql} from 'graphql-request'

export const PushConfig = gql`
  mutation appUpdate($apiKey: String!, $applicationUrl: Url, $redirectUrlAllowlist: [Url]) {
    appUpdate(input: {apiKey: $apiKey, applicationUrl: $applicationUrl, redirectUrlWhitelist: $redirectUrlAllowlist}) {
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
  redirectUrlAllowlist: string[]
}

export interface PushConfigSchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
