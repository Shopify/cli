import {gql} from 'graphql-request'

export const FindAppQuery = gql`
  query FindApp($apiKey: String!) {
    app(apiKey: $apiKey) {
      id
      title
      apiKey
      apiSecretKeys {
        secret
      }
      appType
    }
  }
`

export interface FindAppQuerySchema {
  app: {
    id: string
    title: string
    apiKey: string
    apiSecretKeys: {
      secret: string
    }[]
    appType: string
  }
}
