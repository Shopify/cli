import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const AppVersionByIdQuery = gql`
  query AppVersionById($versionId: ID!) {
    version(id: $versionId) {
     id
     metadata {
       versionTag
     }
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
`

export interface AppVersionByIdQueryVariables {
  versionId: string
}

interface AppModuleSpecification {
  identifier: string
  externalIdentifier: string
  name: string
}

export interface AppModule {
  uuid: string
  handle: string
  config: JsonMapType
  specification: AppModuleSpecification
}

export interface AppVersionByIdQuerySchema {
  version: {
    id: string
    metadata: {
      versionTag: string
    }
    appModules: AppModule[]
  }
}
