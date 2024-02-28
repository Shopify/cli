import {gql} from 'graphql-request'

export const ActiveAppReleaseQuery = gql`
  query activeAppRelease($appId: ID!) {
    app(id: $appId) {
      activeRelease {
        id
        version {
          modules {
            gid
            handle
            config
            specification {
              identifier
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
  handle: string
  config: string
  specification: AppModuleSpecification
}

export interface ActiveAppReleaseQuerySchema {
  app: {
    activeRelease: {
      id: string
      version: {
        modules: AppModule[]
      }
    }
  }
}
