import {gql} from 'graphql-request'

export const UpdateURLsQuery = gql`
  mutation appUpdate($apiKey: String!, $applicationUrl: Url!, $redirectUrlWhitelist: [Url]!, $appProxy: AppProxyInput) {
    appUpdate(
      input: {
        apiKey: $apiKey
        applicationUrl: $applicationUrl
        redirectUrlWhitelist: $redirectUrlWhitelist
        appProxy: $appProxy
      }
    ) {
      userErrors {
        message
        field
      }
    }
  }
`

export interface UpdateURLsVariables {
  apiKey: string
  applicationUrl: string
  redirectUrlWhitelist: string[]
  appProxy?: {proxyUrl: string; proxySubPath: string; proxySubPathPrefix: string}
}

export interface UpdateURLsSchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
