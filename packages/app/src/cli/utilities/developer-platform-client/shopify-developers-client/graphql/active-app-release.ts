import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const ActiveAppReleaseQuery = gql`
  query activeAppRelease($appId: ID!) {
    app(id: $appId) {
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
      activeRelease {
        id
        version {
          modules {
            gid
            uid
            handle
            config
            specification {
              identifier
              externalIdentifier
              name
              experience
            }
          }
        }
      }
    }
  }
`

export interface ActiveAppReleaseQueryVariables {
  appId: string
}

export interface AppModuleSpecification {
  identifier: string
  externalIdentifier: string
  name: string
  experience: 'EXTENSION' | 'CONFIGURATION' | 'DEPRECATED'
}

export interface AppModule {
  gid: string
  uid: string
  handle: string
  config: JsonMapType
  specification: AppModuleSpecification
}

export interface ActiveAppReleaseQuerySchema {
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
    activeRelease?: {
      id: string
      version: {
        modules: AppModule[]
      }
    }
  }
}
