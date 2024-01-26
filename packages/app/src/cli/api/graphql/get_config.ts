import {gql} from 'graphql-request'

export const GetConfig = gql`
  query GetConfig($apiKey: String!) {
    app(apiKey: $apiKey) {
      id
      title
      apiKey
      organizationId
      appType
      grantedScopes
      applicationUrl
      redirectUrlWhitelist
      preferencesUrl
      webhookApiVersion
      embedded
      posEmbedded
      requestedAccessScopes
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
      betas {
        declarativeWebhooks
      }
      disabledBetas
    }
  }
`

export interface App {
  id: string
  title: string
  apiKey: string
  organizationId: string
  appType: string
  grantedScopes: string[]
  applicationUrl: string
  redirectUrlWhitelist: string[]
  webhookApiVersion: string
  embedded: boolean
  posEmbedded?: boolean
  preferencesUrl?: string
  requestedAccessScopes?: string[]
  gdprWebhooks?: {
    customerDeletionUrl?: string
    customerDataRequestUrl?: string
    shopDeletionUrl?: string
  }
  appProxy?: {
    proxySubPath: string
    proxySubPathPrefix: string
    proxyUrl: string
  }
  betas?: {
    declarativeWebhooks?: boolean
  }
  disabledBetas: string[]
}

export interface GetConfigQuerySchema {
  app: App
  appProxy?: {
    subPath?: string
    subPathPrefix?: string
    url?: string
  }
  preferencesUrl?: string
}
