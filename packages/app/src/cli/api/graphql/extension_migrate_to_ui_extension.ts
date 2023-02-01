import {gql} from 'graphql-request'

export const ExtensionMigrateToUiExtensionQuery = gql`
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

export interface ExtensionMigrateToUiExtensionVariables {
  apiKey: string
  registrationId: string
}

export interface ExtensionMigrateToUiExtensionSchema {
  migrateToUiExtension: {
    migratedToUiExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
