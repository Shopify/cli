import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const CreateAppVersionMutation = gql`
  mutation CreateAppVersion($appId: ID!, $version: AppVersionInput!, $metadata: VersionMetadataInput) {
    appVersionCreate(appId: $appId, version: $version, metadata: $metadata) {
      version {
        id
        appModules {
          uuid
          handle
          config
          specification {
            identifier
            name
          }
        }
        metadata {
          versionTag
        }
      }
      userErrors {
        field
        message
        category
        code
        on
      }
    }
  }
`

export interface CreateAppVersionMutationVariables {
  appId: string
  version: {sourceUrl: string} | {source: JsonMapType}
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
  uuid: string
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
      appModules: AppModule[]
      metadata: {
        versionTag: string
        message: string
      }
    }
    userErrors: {
      field: string[]
      message: string
      category: string
      code: string
      on: JsonMapType
    }[]
  }
}
