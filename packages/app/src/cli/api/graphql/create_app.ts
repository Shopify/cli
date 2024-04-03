import {gql} from 'graphql-request'

export const CreateAppQuery = gql`
  mutation AppCreate(
    $org: Int!
    $title: String!
    $appUrl: Url!
    $redir: [Url]!
    $type: AppType
    $requestedAccessScopes: [String!]
  ) {
    appCreate(
      input: {
        organizationID: $org
        title: $title
        applicationUrl: $appUrl
        redirectUrlWhitelist: $redir
        appType: $type
        requestedAccessScopes: $requestedAccessScopes
      }
    ) {
      app {
        id
        title
        apiKey
        organizationId
        apiSecretKeys {
          secret
        }
        appType
        grantedScopes
        applicationUrl
        redirectUrlWhitelist
        requestedAccessScopes
        webhookApiVersion
        embedded
        posEmbedded
        preferencesUrl
        gdprWebhooks {
          customerDeletionUrl
          customerDataRequestUrl
          shopDeletionUrl
        }
        appProxy {
          subPath
          subPathPrefix
          url
        }
        disabledFlags
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface CreateAppQueryVariables {
  org: number
  title: string
  appUrl: string
  redir: string[]
  type: string
  requestedAccessScopes?: string[]
}

export interface CreateAppQuerySchema {
  appCreate: {
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
      applicationUrl: string
      redirectUrlWhitelist: string[]
      requestedAccessScopes?: string[]
      webhookApiVersion: string
      embedded: boolean
      posEmbedded?: boolean
      preferencesUrl?: string
      gdprWebhooks?: {
        customerDeletionUrl?: string
        customerDataRequestUrl?: string
        shopDeletionUrl?: string
      }
      appProxy?: {
        subPath: string
        subPathPrefix: string
        url: string
      }
      disabledFlags: string[]
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
