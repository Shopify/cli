import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const ActiveAppReleaseQuery = gql`
  query activeAppRelease($appId: ID!) {
    app(id: $appId) {
      id
      key
      activeRoot {
        clientCredentials {
          secrets {
            key
          }
        }
      }
      activeRelease {
        id
        version {
          name
          appModules {
            uuid
            handle
            config
            specification {
              identifier
              externalIdentifier
              name
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

interface AppModuleSpecification {
  identifier: string
  externalIdentifier: string
  name: string
}

interface AppModule {
  uuid: string
  handle: string
  config: JsonMapType
  specification: AppModuleSpecification
}

export interface ActiveAppReleaseQuerySchema {
  app: {
    id: string
    key: string
    activeRoot: {
      clientCredentials: {
        secrets: {
          key: string
        }[]
      }
    }
    activeRelease: {
      id: string
      version: {
        name: string
        appModules: AppModule[]
      }
    }
  }
}
