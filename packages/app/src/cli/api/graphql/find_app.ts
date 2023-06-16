import {gql} from 'graphql-request'

export const FindAppQuery = gql`
  query FindApp($apiKey: String!) {
    app(apiKey: $apiKey) {
      id
      title
      apiKey
      organizationId
      apiSecretKeys {
        secret
      }
      appType
      grantedScopes
      betas {
        unifiedAppDeployment
      }
      applicationUrl
      redirectUrlWhitelist
    }
  }
`

export interface FindAppQuerySchema {
  app: {
    id: string
    title: string
    apiKey: string
    organizationId: string
    apiSecretKeys: {
      secret: string
    }[]
    appType: string
    grantedScopes: string[]
    betas?: {
      unifiedAppDeployment?: boolean
    }
    applicationUrl: string
    redirectUrlWhitelist: string[]
  }
}
