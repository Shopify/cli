import {gql} from 'graphql-request'

export const PushConfig = gql`
  mutation appUpdate($apiKey: String!, $applicationUrl: Url, $redirectUrlWhitelist: [Url]) {
    appUpdate(input: {apiKey: $apiKey, applicationUrl: $applicationUrl, redirectUrlWhitelist: $redirectUrlWhitelist}) {
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
  redirectUrlWhitelist: string[]
}

export interface PushConfigSchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
