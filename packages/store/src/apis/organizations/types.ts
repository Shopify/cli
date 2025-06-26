export interface Organization {
  id: string
  name: string
  accessibleShops: NodeCollection<Shop, PageInfo>
  bulkData: BulkData
}

export interface BulkData {
  operation: BulkDataOperation
  operations: NodeCollection<BulkDataOperation, PageInfo>
}

export interface BulkDataOperation {
  id: string
  operationType: string
  status: string
  sourceShop: Shop
  targetShop: Shop
}

export interface Shop {
  id: string
  name: string
  url: string
  storeType: string
}

export interface PageInfo {
  pageInfo: {
    endCursor: string
    hasNextPage: boolean
  }
}

export type NodeCollection<TNode, TPageInfo = {[key: string]: never}> = TPageInfo & {
  nodes: TNode[]
}

export interface OrganizationsSchema {
  organization: Organization | null
}

export interface BulkDataStoreCopyStartInput {
  sourceStoreIdentifier: {
    domain: string
  }
  targetStoreIdentifier: {
    domain: string
  }
  resourceConfigs: {
    [key: string]: {
      identifier: {
        field: string
      }
    }
  }
}

export interface BulkDataStoreCopyStartResponse {
  bulkDataStoreCopyStart: {
    success: boolean
    operation: {
      id: string
      operationType: string
      status: string
    }
    userErrors: {
      field: string
      message: string
    }[]
  }
}

export interface BulkDataStoreExportStartInput {
  sourceStoreIdentifier: {
    domain: string
  }
}

export interface BulkDataStoreExportStartResponse {
  bulkDataStoreExportStart: {
    success: boolean
    operation: {
      id: string
      operationType: string
      status: string
    }
    userErrors: {
      field: string
      message: string
    }[]
  }
}

export interface BulkDataStoreImportStartInput {
  targetStoreIdentifier: {
    domain: string
  }
  importUrl: string
  resourceConfigs?: {
    [key: string]: {
      identifier: {
        field: string
      }
    }
  }
}

export interface BulkDataStoreImportStartResponse {
  bulkDataStoreImportStart: {
    success: boolean
    operation: {
      id: string
      operationType: string
      status: string
    }
    userErrors: {
      field: string
      message: string
    }[]
  }
}

export interface BulkDataOperationByIdResponse {
  organization: {
    name: string
    bulkData: {
      operation: {
        id: string
        operationType: string
        status: string
        sourceStore: {
          id: string
          name: string
        }
        targetStore: {
          id: string
          name: string
        }
        storeOperations: {
          id: string
          store: {
            id: string
            name: string
          }
          remoteOperationType: string
          remoteOperationStatus: string
          totalObjectCount: number
          completedObjectCount: number
          url: string
        }[]
      }
    }
  }
}
