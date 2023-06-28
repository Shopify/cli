import {gql} from 'graphql-request'

export const ExtensionMigrateFlowExtensionQuery = gql`
  mutation MigrateFlowExtension($apiKey: String!, $registrationId: ID!) {
    migrateFlowExtension(input: {apiKey: $apiKey, registrationId: $registrationId}) {
      migratedToUiExtension
      userErrors {
        field
        message
      }
    }
  }
`

export interface ExtensionMigrateFlowExtensionVariables {
  apiKey: string
  registrationId: string
  specificationIdentifier: string
}

export interface ExtensionMigrateFlowExtensionSchema {
  migrateFlowExtension: {
    migratedFlowExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
