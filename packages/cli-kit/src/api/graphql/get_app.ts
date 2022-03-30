import {gql} from 'graphql-request'

export const GetAppQuery = gql`
  query getApp($apiKey: String!) {
    app(apiKey: $apiKey) {
      title
      apiKey
      apiSecretKeys {
        secret
      }
    }
  }
`

export interface GetAppQuerySchema {
  app: {
    title: string
    apiKey: string
    apiSecretKeys: {
      secret: string
    }[]
  }
}
