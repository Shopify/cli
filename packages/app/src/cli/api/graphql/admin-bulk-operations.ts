import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const BulkOperationRunQuery = gql`
  mutation BulkOperationRunQuery($query: String!) {
    bulkOperationRunQuery(query: $query) {
      bulkOperation {
        id
        status
        errorCode
        createdAt
        objectCount
        fileSize
        url
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface BulkOperation {
  id: string
  status: string
  errorCode: string | null
  createdAt: string
  objectCount: string
  fileSize: string
  url: string | null
}

export interface BulkOperationError {
  field: string[] | null
  message: string
}

export interface BulkOperationRunQuerySchema {
  bulkOperationRunQuery: {
    bulkOperation: BulkOperation | null
    userErrors: BulkOperationError[]
  }
}
