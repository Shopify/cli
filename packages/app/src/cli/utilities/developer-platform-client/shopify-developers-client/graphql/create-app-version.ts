import {gql} from 'graphql-request'

export const CreateAppVersionMutation = gql`
  mutation CreateAppVersion(
    $appId: ID!
    $appModules: [NewModuleVersion!]!
    $assetsUrl: String
    $versionTag: String
    $gitUrl: String
  ) {
    versionCreate(
      appId: $appId
      modules: $appModules
      assetsUrl: $assetsUrl
      versionTag: $versionTag
      gitUrl: $gitUrl
    ) {
      version {
        id
        modules {
          gid
          uid
          handle
          config
          specification {
            identifier
            name
            experience
          }
        }
        versionTag
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
  appModules: {
    uid: string
    specificationIdentifier?: string
    config: string
  }[]
  assetsUrl?: string
  versionTag?: string
  gitUrl?: string
}

interface AppModuleSpecification {
  identifier: string
  name: string
  experience: 'EXTENSION' | 'CONFIGURATION' | 'DEPRECATED'
}

interface AppModule {
  gid: string
  uid: string
  handle: string
  config: {
    [key: string]: string | number | boolean | string[]
  }
  specification: AppModuleSpecification
}

export interface CreateAppVersionMutationSchema {
  versionCreate: {
    version: {
      id: string
      modules: AppModule[]
      versionTag: string
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
