export const sqliteOperationQuery = `
    query sqliteOperation($id: ID!) {
      sqliteOperation(id: $id) {
        id
        status
        type
        url
      }
    }
  `

export const bulkDataExportStartMutation = `
    mutation bulkDataExportStart {
      bulkDataExportStart {
        sqliteOperation {
          id
          type
          status
        }
      }
    }
  `

export const bulkDataImportStartMutation = `
    mutation bulkDataImportStart($importFileUrl: String!) {
      bulkDataImportStart(importFileUrl: $importFileUrl, resetShopifyIds: true, features: ["use_product_set"]) {
        sqliteOperation {
          id
          status
        }
      }
    }
  `

// TODO: fix this query -- I don't know if any query exists to get shop by handle.
export const shopByHandleQuery = `
    query shopByHandle($handle: String!) {
      shop(handle: $handle) {
        id
        organization {
          id
        }
      }
    }
  `

export const bulkDataStoreCopyStartMutation = `
    mutation BulkDataStoreCopyStart($input: StoreCopyStartInput!) {
      bulkDataStartStoreCopy(input: $input) {
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

export const bulkDataOperationQuery = `
  query BulkDataOperationById($id: BulkDataOperationID!) {
    organization {
      name
      bulkData {
        operation(id: $id) {
          id
          operationType
          status
          sourceShop {
            id
            name
          }
          targetShop {
            id
            name
          }
          storeOperations {
            id
            shop {
              id
              name
            }
            sqliteOperationType
            sqliteOperationStatus
            totalObjectsCount
            completedObjectsCount
          }
        }
      }
    }
  }
  `

export const CurrentUserAccountQuery = `#graphql
  query currentUserAccount {
    currentUserAccount {
      email
      organizations(first: 100) {
        edges {
          node {
            id
            name
            categories(handles: STORES) {
              destinations(first: 100) {
                edges {
                  node {
                    ...destinationFields
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
      orphanDestinations {
        categories(handles: STORES) {
          destinations(first: 100) {
            edges {
              node {
                ...destinationFields
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  }

  fragment destinationFields on Destination {
    name
    status
    webUrl
    id
  }
`
