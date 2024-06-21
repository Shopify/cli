import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const AppsQuery = gql`
  query listApps {
    apps {
      id
      key
      activeRelease {
        id
        version {
          name
          appModules {
            uuid
            handle
            config
            specification {
              externalIdentifier
            }
          }
        }
      }
    }
  }
`

interface MinimalAppModule {
  uuid: string
  handle: string
  config: JsonMapType
  specification: {
    externalIdentifier: string
  }
}

export interface AppsQuerySchema {
  apps: {
    id: string
    key: string
    activeRelease: {
      id: string
      version: {
        name: string
        appModules: MinimalAppModule[]
      }
    }
  }[]
}
