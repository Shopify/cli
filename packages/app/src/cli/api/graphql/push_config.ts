import {gql} from 'graphql-request'

export const PushConfig = gql`
  mutation appUpdate(
    $title: String!
    $apiKey: String!
    $applicationUrl: Url
    $redirectUrlAllowlist: [Url]
    $requestedAccessScopes: [String!]
    $contactEmail: String!
    $webhookApiVersion: String!
    $gdprWebhooks: GdprWebhooksInput
    $appProxy: AppProxyInput
    $posEmbedded: Boolean
    $embedded: Boolean
    $preferencesUrl: Url
  ) {
    appUpdate(
      input: {
        title: $title
        apiKey: $apiKey
        contactEmail: $contactEmail
        applicationUrl: $applicationUrl
        redirectUrlWhitelist: $redirectUrlAllowlist
        requestedAccessScopes: $requestedAccessScopes
        webhookApiVersion: $webhookApiVersion
        gdprWebhooks: $gdprWebhooks
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

export interface PushConfigVariables {
  title: string
  apiKey: string
  applicationUrl: string
  redirectUrlAllowlist: string[]
  requestedAccessScopes: string[]
  webhookApiVersion: string
}

export interface PushConfigSchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
