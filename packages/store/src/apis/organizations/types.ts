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
    id: string
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
          url?: string
        }[]
      }
    }
  }
}
