import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const MigrateToUiExtensionQuery = gql`
  mutation MigrateToUiExtension($apiKey: String!, $registrationId: ID, $registrationUuid: String) {
    migrateToUiExtension(
      input: {apiKey: $apiKey, registrationId: $registrationId, registrationUuid: $registrationUuid}
    ) {
      migratedToUiExtension
      userErrors {
        field
        message
      }
    }
  }
`

export interface MigrateToUiExtensionVariables {
  apiKey: string
  registrationId?: string
  registrationUuid?: string
}

export interface MigrateToUiExtensionSchema {
  migrateToUiExtension: {
    migratedToUiExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
