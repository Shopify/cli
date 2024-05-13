import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const AppVersionByIdQuery = gql`
  query AppVersionById($appId: ID!, $versionId: ID!) {
    app(id: $appId) {
      id
      version(versionId: $versionId) {
        id
        versionTag
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
`

export interface AppVersionByIdQueryVariables {
  appId: string
  versionId: string
}

interface AppModuleSpecification {
  identifier: string
  externalIdentifier: string
  name: string
  experience: 'EXTENSION' | 'CONFIGURATION' | 'DEPRECATED'
}

interface AppModule {
  gid: string
  uid: string
  handle: string
  config: JsonMapType
  specification: AppModuleSpecification
}

export interface AppVersionByIdQuerySchema {
  app: {
    id: string
    version: {
      id: string
      versionTag: string
      modules: AppModule[]
    }
  }
}
