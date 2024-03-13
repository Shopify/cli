import {gql} from 'graphql-request'

export const ActiveAppReleaseQuery = gql`
  query activeAppRelease($appId: ID!) {
    app(id: $appId) {
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
  config: {
    [key: string]: string | number | boolean | string[]
  }
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
