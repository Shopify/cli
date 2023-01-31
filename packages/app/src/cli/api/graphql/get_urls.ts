import {gql} from 'graphql-request'

export const GetURLsQuery = gql`
  query getApp($apiKey: String!) {
    app(apiKey: $apiKey) {
      applicationUrl
      redirectUrlWhitelist
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
  }
}
