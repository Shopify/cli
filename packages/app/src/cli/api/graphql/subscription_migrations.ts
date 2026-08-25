import {gql} from 'graphql-request'

// 250 matches the maximum migration submission batch size; operation results are currently bounded by that contract.
// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const AppSubscriptionMigrationOperationCreateMutation = gql`
  mutation AppSubscriptionMigrationOperationCreate($input: AppSubscriptionMigrationOperationCreateInput!) {
    appSubscriptionMigrationOperationCreate(input: $input) {
      operation {
        id
        status
        total
        results(first: 250) {
          edges {
            node {
              shopId
              code
            }
          }
        }
      }
      userErrors {
        message
        field
      }
    }
  }
`

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const AppSubscriptionMigrationOperationQuery = gql`
  query AppSubscriptionMigrationOperation($apiKey: String!, $id: ID!) {
    appSubscriptionMigrationOperation(apiKey: $apiKey, id: $id) {
      id
      status
      total
      results(first: 250) {
        edges {
          node {
            shopId
            code
          }
        }
      }
    }
  }
`

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const AppSubscriptionMigrationOperationCancelMutation = gql`
  mutation AppSubscriptionMigrationOperationCancel($input: AppSubscriptionMigrationOperationCancelInput!) {
    appSubscriptionMigrationOperationCancel(input: $input) {
      operation {
        id
        status
        total
        results(first: 250) {
          edges {
            node {
              shopId
              code
            }
          }
        }
      }
      userErrors {
        message
        field
      }
    }
  }
`
