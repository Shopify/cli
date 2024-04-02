import {gql} from 'graphql-request'

export const CreateAppMutation = gql`
  mutation CreateApp($appModules: [NewModuleVersion!]!) {
    appCreate(appModules: $appModules) {
      app {
        id
        title
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
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface CreateAppMutationVariables {
  appModules: {
    uid: string
    specificationIdentifier: string
    config: string
  }[]
  assetsUrl?: string
}

export interface CreateAppMutationSchema {
  appCreate: {
    app: {
      id: string
      title: string
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
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
