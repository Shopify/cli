import {gql} from 'graphql-request'

export const MigrateMarketingActivityExtensionMutation = gql`
  mutation MigrateMarketingActivityExtension($apiKey: String!, $registrationId: ID!) {
    migrateMarketingActivityExtension(input: {apiKey: $apiKey, registrationId: $registrationId}) {
      migratedExtensionToCli
      userErrors {
        field
        message
      }
    }
  }
`

export interface MigrateMarketingActivityExtensionVariables {
  apiKey: string
  registrationId: string
}

export interface MigrateMarketingActivityExtensionSchema {
  migrateMarketingActivityExtension: {
    migratedExtensionToCli: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
