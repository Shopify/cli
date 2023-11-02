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
      requestedAccessScopes
      webhookApiVersion
      embedded
      posEmbedded
      preferencesUrl
      privacyWebhooks {
        customerDeletionUrl
        customerDataRequestUrl
        shopDeletionUrl
      }
      appProxy {
        subPath
        subPathPrefix
        url
      }
      developmentStorePreviewEnabled
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
    requestedAccessScopes?: string[]
    webhookApiVersion: string
    embedded: boolean
    posEmbedded?: boolean
    preferencesUrl?: string
    privacyWebhooks?: {
      customerDeletionUrl?: string
      customerDataRequestUrl?: string
      shopDeletionUrl?: string
    }
    appProxy?: {
      subPath: string
      subPathPrefix: string
      url: string
    }
    developmentStorePreviewEnabled: boolean
  }
}
