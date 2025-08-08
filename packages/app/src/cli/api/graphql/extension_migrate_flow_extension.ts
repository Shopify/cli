import {gql} from 'graphql-request'

export const MigrateFlowExtensionMutation = gql`
  mutation MigrateFlowExtension($apiKey: String!, $registrationId: ID, $registrationUuid: String) {
    migrateFlowExtension(
      input: {apiKey: $apiKey, registrationId: $registrationId, registrationUuid: $registrationUuid}
    ) {
      migratedFlowExtension
      userErrors {
        field
        message
      }
    }
  }
`

export interface MigrateFlowExtensionVariables {
  apiKey: string
  registrationId?: string
  registrationUuid?: string
}

export interface MigrateFlowExtensionSchema {
  migrateFlowExtension: {
    migratedFlowExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
