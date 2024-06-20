import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const AppVersionByIdQuery = gql`
  query AppVersionById($appId: ID!, $versionId: ID!) {
    app(id: $appId) {
      id
      key
      version(versionId: $versionId) {
        id
        versionTag
        modules {
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

export interface AppModule {
  uid: string
  handle: string
  config: JsonMapType
  specification: AppModuleSpecification
}

export interface AppVersionByIdQuerySchema {
  app: {
    id: string
    key: string
    version: {
      id: string
      versionTag: string
      modules: AppModule[]
    }
  }
}
