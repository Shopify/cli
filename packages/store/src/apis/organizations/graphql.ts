import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const bulkDataStoreCopyStartMutation = gql`
  mutation BulkDataStoreCopyStart($input: BulkDataStoreCopyStartInput!) {
    bulkDataStoreCopyStart(input: $input) {
      success
      operation {
        id
        operationType
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const bulkDataOperationByIdQuery = `#graphql
  query BulkDataOperationById($id: BulkDataOperationID!) {
    organization {
      name
      bulkData {
        operation(id: $id) {
          id
          operationType
          status
          sourceStore {
            id
            name
          }
          targetStore {
            id
            name
          }
          storeOperations {
            id
            store {
              id
              name
            }
            remoteOperationType
            remoteOperationStatus
            totalObjectCount
            completedObjectCount
            url
          }
        }
      }
    }
  }
`
