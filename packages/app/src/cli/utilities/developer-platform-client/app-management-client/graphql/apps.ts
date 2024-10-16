import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const AppsQuery = gql`
  query listApps($query: String) {
    apps(query: $query, first: 50) {
      edges {
        node {
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
      pageInfo {
        hasNextPage
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

export interface AppsQueryVariables {
  query?: string
}

export interface AppsQuerySchema {
  apps: {
    edges: {
      node: {
        id: string
        key: string
        activeRelease: {
          id: string
          version: {
            name: string
            appModules: MinimalAppModule[]
          }
        }
      }
    }[]
    pageInfo: {
      hasNextPage: boolean
    }
  }
}
