import {gql} from 'graphql-request'

export const MigrateToUiExtensionQuery = gql`
  mutation MigrateToUiExtension($apiKey: String!, $registrationId: ID!) {
    migrateToUiExtension(input: {apiKey: $apiKey, registrationId: $registrationId}) {
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
  registrationId: string
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
