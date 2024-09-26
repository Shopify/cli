import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const MigrateAppsQuery = gql`
  mutation migrateApps($input: MigrateAppsInput!) {
    migrateApps(input: $input) {
      migratedApps
      userErrors {
        message
        field
      }
    }
  }
`

export interface MigrateAppsVariables {
  input: {
    organizationID: number
  }
}

export interface MigrateAppsSchema {
  migrateApps: {
    migratedApps: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
