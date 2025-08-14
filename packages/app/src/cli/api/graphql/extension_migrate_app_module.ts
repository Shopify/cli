import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const MigrateAppModuleMutation = gql`
  mutation MigrateAppModule($apiKey: String!, $registrationId: ID, $registrationUuid: String, $type: String!) {
    migrateAppModule(
      input: {apiKey: $apiKey, registrationId: $registrationId, registrationUuid: $registrationUuid, type: $type}
    ) {
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
  registrationId?: string
  registrationUuid?: string
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
