import {gql} from 'graphql-request'

export const GetURLsQuery = gql`
  query getApp($apiKey: String!) {
    app(apiKey: $apiKey) {
      applicationUrl
      redirectUrlWhitelist
      appProxy {
        url
        subPath
        subPathPrefix
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
    appProxy?: {
      url: string
      subPath: string
      subPathPrefix: string
    }
  }
}
