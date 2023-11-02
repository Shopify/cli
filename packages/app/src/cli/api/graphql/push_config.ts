import {gql} from 'graphql-request'

export const PushConfig = gql`
  mutation appUpdate(
    $title: String!
    $apiKey: String!
    $applicationUrl: Url
    $redirectUrlAllowlist: [Url]
    $requestedAccessScopes: [String!]
    $webhookApiVersion: String!
    $privacyWebhooks: PrivacyWebhooksInput
    $appProxy: AppProxyInput
    $posEmbedded: Boolean
    $embedded: Boolean
    $preferencesUrl: Url
  ) {
    appUpdate(
      input: {
        title: $title
        apiKey: $apiKey
        applicationUrl: $applicationUrl
        redirectUrlWhitelist: $redirectUrlAllowlist
        requestedAccessScopes: $requestedAccessScopes
        webhookApiVersion: $webhookApiVersion
        privacyWebhooks: $privacyWebhooks
        appProxy: $appProxy
        posEmbedded: $posEmbedded
        embedded: $embedded
        preferencesUrl: $preferencesUrl
      }
    ) {
      userErrors {
        message
        field
      }
    }
  }
`

interface PrivacyWebhooks {
  customerDeletionUrl?: string
  customerDataRequestUrl?: string
  shopDeletionUrl?: string
}

interface AppProxy {
  proxyUrl: string
  proxySubPath: string
  proxySubPathPrefix: string
}

export interface PushConfigVariables {
  title: string
  apiKey: string
  applicationUrl?: string
  redirectUrlAllowlist?: string[] | null
  requestedAccessScopes?: string[]
  webhookApiVersion?: string
  privacyWebhooks?: PrivacyWebhooks
  appProxy?: AppProxy
  posEmbedded?: boolean
  embedded?: boolean
  preferencesUrl?: string | null
}

export interface PushConfigSchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
