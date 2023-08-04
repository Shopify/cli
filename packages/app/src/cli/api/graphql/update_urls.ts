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

export interface UpdateURLsQueryVariables {
  apiKey: string
  applicationUrl: string
  redirectUrlWhitelist: string[]
  appProxy?: {proxyUrl: string; proxySubPath: string; proxySubPathPrefix: string}
}

export interface UpdateURLsQuerySchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
