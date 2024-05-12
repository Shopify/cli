import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const AppVersionByTagQuery = gql`
  query AppVersionByTag($appId: ID!, $versionId: ID!) {
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
            externalIdentifier
            name
            experience
          }
        }
      }
    }
  }
`

export interface AppVersionByTagQueryVariables {
  appId: string
  versionId: string
}

interface AppModuleSpecification {
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

export interface AppVersionByTagQuerySchema {
  app: {
    id: string
    version: {
      id: string
      versionTag: string
      modules: AppModule[]
    }
  }
}
