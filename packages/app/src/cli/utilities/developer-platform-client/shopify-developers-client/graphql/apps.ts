import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const AppsQuery = gql`
  query listApps {
    apps {
      id
      activeRelease {
        id
        version {
          modules {
            gid
            uid
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

export interface MinimalAppModule {
  gid: string
  uid: string
  handle: string
  config: JsonMapType
  specification: {
    externalIdentifier: string
  }
}

export interface AppsQuerySchema {
  apps: {
    id: string
    activeRelease: {
      id: string
      version: {
        modules: MinimalAppModule[]
      }
    }
  }[]
}
