import {gql} from 'graphql-request'

export const GetURLsQuery = gql`
  query getApp($apiKey: String!) {
    app(apiKey: $apiKey) {
      applicationUrl
      redirectUrlWhitelist
      appProxy: {
        proxyUrl
        proxySubPath
        proxySubPathPrefix
      }
    }
  }
`

export interface GetURLsQueryVariables {
  apiKey: string
}

export interface GetURLsQuerySchema {
  app: {
    applicationUrl: string
    redirectUrlWhitelist: string[]
    appProxy: {
      proxyUrl: string
      proxySubPath: string
      proxySubPathPrefix: string
    }
  }
}
