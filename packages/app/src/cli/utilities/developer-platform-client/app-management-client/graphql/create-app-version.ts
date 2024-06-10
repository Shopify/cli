import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

export const CreateAppVersionMutation = gql`
  mutation CreateAppVersion(
    $appId: ID!
    $appSource: [AppSourceInput!]!
    $name: String
    $metadata: VersionMetadataInput
  ) {
    appVersionCreate(
      appId: $appId
      appSource: $appSource
      name: $name
      metadata: $metadata
    ) {
      version {
        id
        modules {
          key
          uid
          handle
          config
          specification {
            identifier
            name
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface CreateAppVersionMutationVariables {
  appId: string
  appSource: {
    assetsUrl?: string
    modules: {
      uid: string
      specificationIdentifier?: string
      config: JsonMapType
    }[]
  }
  name?: string
  metadata?: {
    message?: string
    sourceControlUrl?: string
    versionTag?: string
  }
}

interface AppModuleSpecification {
  identifier: string
  name: string
}

interface AppModule {
  key: string
  uid: string
  handle: string
  config: {
    [key: string]: string | number | boolean | string[]
  }
  specification: AppModuleSpecification
}

export interface CreateAppVersionMutationSchema {
  appVersionCreate: {
    version: {
      id: string
      modules: AppModule[]
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
