import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const ActiveAppReleaseQuery = gql`
  query activeAppRelease($appId: Int!) {
    app(id: $appId) {
      id
      activeRelease {
        id
        version {
          modules {
            key
            uid
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
  appId: number
}

interface AppModuleSpecification {
  identifier: string
  externalIdentifier: string
  name: string
  experience: 'EXTENSION' | 'CONFIGURATION' | 'DEPRECATED'
}

interface AppModule {
  key: string
  uid: string
  handle: string
  config: JsonMapType
  specification: AppModuleSpecification
}

export interface ActiveAppReleaseQuerySchema {
  app: {
    id: string
    activeRelease: {
      id: string
      version: {
        modules: AppModule[]
      }
    }
  }
}
