import {gql} from 'graphql-request'

export const MigrateAppModuleMutation = gql`
  mutation MigrateAppModule($apiKey: String!, $registrationId: ID!, $type: String!) {
    migrateAppModule(input: {apiKey: $apiKey, registrationId: $registrationId, type: $type}) {
      migratedAppModule
      userErrors {
        field
        message
      }
    }
  }
`

export interface MigrateAppModuleVariables {
  apiKey: string
  registrationId: string
  type: string
}

export interface MigrateAppModuleSchema {
  migrateAppModule: {
    migratedAppModule: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
