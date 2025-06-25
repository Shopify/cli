import {Shop} from '../../../apis/destinations/index.js'
import {
  BulkDataStoreCopyStartResponse,
  BulkDataStoreExportStartResponse,
  BulkDataStoreImportStartResponse,
  BulkDataOperationByIdResponse,
} from '../../../apis/organizations/types.js'

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export const TEST_MOCK_DATA = {
  sourceShop: {
    id: 'shop1',
    name: 'Source Shop',
    status: 'ACTIVE',
    webUrl: 'https://source.myshopify.com',
    handle: 'source',
    publicId: 'gid://shopify/Shop/1',
    shortName: 'source',
    domain: 'source.myshopify.com',
    organizationId: 'org1',
  },
  targetShop: {
    id: 'shop2',
    name: 'Target Shop',
    status: 'ACTIVE',
    webUrl: 'https://target.myshopify.com',
    handle: 'target',
    publicId: 'gid://shopify/Shop/2',
    shortName: 'target',
    domain: 'target.myshopify.com',
    organizationId: 'org1',
  },
  organization: {
    id: 'org1',
    name: 'Test Organization',
    shops: [] as Shop[],
  },
  differentOrgShop: {
    id: 'shop3',
    name: 'Shop In Other Org',
    status: 'ACTIVE',
    webUrl: 'https://different.myshopify.com',
    handle: 'other-org',
    publicId: 'gid://shopify/Shop/3',
    shortName: 'other-org',
    domain: 'other-org.myshopify.com',
    organizationId: 'org2',
  },
  differentOrganization: {
    id: 'org2',
    name: 'Different Organization',
    shops: [] as Shop[],
  },
  singleShop: {
    id: 'shop4',
    name: 'Single Shop',
    status: 'ACTIVE',
    webUrl: 'https://single.myshopify.com',
    handle: 'single',
    publicId: 'gid://shopify/Shop/4',
    shortName: 'single',
    domain: 'single.myshopify.com',
    organizationId: 'org3',
  },
  singleShopOrganization: {
    id: 'org3',
    name: 'Single Shop Org',
    shops: [] as Shop[],
  },
}

TEST_MOCK_DATA.organization.shops = [TEST_MOCK_DATA.sourceShop, TEST_MOCK_DATA.targetShop]
TEST_MOCK_DATA.differentOrganization.shops = [TEST_MOCK_DATA.sourceShop, TEST_MOCK_DATA.differentOrgShop]
TEST_MOCK_DATA.singleShopOrganization.shops = [TEST_MOCK_DATA.singleShop]

export const TEST_COPY_START_RESPONSE: BulkDataStoreCopyStartResponse = {
  bulkDataStoreCopyStart: {
    success: true,
    userErrors: [],
    operation: {
      id: 'operation-123',
      operationType: 'STORE_COPY',
      status: 'IN_PROGRESS',
    },
  },
}

export const TEST_EXPORT_START_RESPONSE: BulkDataStoreExportStartResponse = {
  bulkDataStoreExportStart: {
    success: true,
    userErrors: [],
    operation: {
      id: 'export-operation-123',
      operationType: 'EXPORT',
      status: 'IN_PROGRESS',
    },
  },
}

export const TEST_IMPORT_START_RESPONSE: BulkDataStoreImportStartResponse = {
  bulkDataStoreImportStart: {
    success: true,
    userErrors: [],
    operation: {
      id: 'import-operation-123',
      operationType: 'IMPORT',
      status: 'IN_PROGRESS',
    },
  },
}

export const TEST_COMPLETED_OPERATION: BulkDataOperationByIdResponse = {
  organization: {
    name: 'Test Organization',
    bulkData: {
      operation: {
        id: 'operation-123',
        operationType: 'STORE_COPY',
        status: 'COMPLETED',
        sourceStore: {
          id: 'shop1',
          name: 'Source Shop',
        },
        targetStore: {
          id: 'shop2',
          name: 'Target Shop',
        },
        storeOperations: [
          {
            id: 'store-op-1',
            store: {
              id: 'shop2',
              name: 'Target Shop',
            },
            remoteOperationType: 'COPY',
            remoteOperationStatus: 'COMPLETED',
            totalObjectCount: 100,
            completedObjectCount: 100,
            url: 'https://target.myshopify.com/exported_data.sqlite',
          },
        ],
      },
    },
  },
}

export function generateTestOperationResponse(
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
): BulkDataOperationByIdResponse {
  const cloned = deepClone(TEST_COMPLETED_OPERATION)
  cloned.organization.bulkData.operation.status = status

  if (status === 'FAILED') {
    cloned.organization.bulkData.operation.storeOperations = []
  }

  return cloned
}

export function generateTestFailedStartResponse(): BulkDataStoreCopyStartResponse {
  const cloned = deepClone(TEST_COPY_START_RESPONSE)

  cloned.bulkDataStoreCopyStart.success = false
  cloned.bulkDataStoreCopyStart.userErrors = [
    {field: 'configuration', message: 'Invalid configuration'},
    {field: 'permissions', message: 'Insufficient permissions'},
  ]
  cloned.bulkDataStoreCopyStart.operation.id = ''
  cloned.bulkDataStoreCopyStart.operation.operationType = ''
  cloned.bulkDataStoreCopyStart.operation.status = 'FAILED'

  return cloned
}

export function generateTestFailedExportStartResponse(): BulkDataStoreExportStartResponse {
  const cloned = deepClone(TEST_EXPORT_START_RESPONSE)

  cloned.bulkDataStoreExportStart.success = false
  cloned.bulkDataStoreExportStart.userErrors = [
    {field: 'configuration', message: 'Invalid export configuration'},
    {field: 'permissions', message: 'Export not allowed'},
  ]
  cloned.bulkDataStoreExportStart.operation.id = ''
  cloned.bulkDataStoreExportStart.operation.operationType = ''
  cloned.bulkDataStoreExportStart.operation.status = 'FAILED'

  return cloned
}

export const TEST_COMPLETED_EXPORT_OPERATION: BulkDataOperationByIdResponse = {
  organization: {
    name: 'Test Organization',
    bulkData: {
      operation: {
        id: 'export-operation-123',
        operationType: 'EXPORT',
        status: 'COMPLETED',
        sourceStore: {
          id: 'shop1',
          name: 'Source Shop',
        },
        targetStore: {
          id: 'shop1',
          name: 'Source Shop',
        },
        storeOperations: [
          {
            id: 'store-op-1',
            store: {
              id: 'shop1',
              name: 'Source Shop',
            },
            remoteOperationType: 'EXPORT',
            remoteOperationStatus: 'COMPLETED',
            totalObjectCount: 100,
            completedObjectCount: 100,
            url: 'https://source.myshopify.com/export_data.sqlite',
          },
        ],
      },
    },
  },
}

export function generateTestFailedImportStartResponse(): BulkDataStoreImportStartResponse {
  const cloned = deepClone(TEST_IMPORT_START_RESPONSE)

  cloned.bulkDataStoreImportStart.success = false
  cloned.bulkDataStoreImportStart.userErrors = [
    {field: 'file', message: 'Invalid file format'},
    {field: 'permissions', message: 'Import not allowed for this store'},
  ]
  cloned.bulkDataStoreImportStart.operation.id = ''
  cloned.bulkDataStoreImportStart.operation.operationType = ''
  cloned.bulkDataStoreImportStart.operation.status = 'FAILED'

  return cloned
}

export const TEST_COMPLETED_IMPORT_OPERATION: BulkDataOperationByIdResponse = {
  organization: {
    name: 'Test Organization',
    bulkData: {
      operation: {
        id: 'import-operation-123',
        operationType: 'IMPORT',
        status: 'COMPLETED',
        sourceStore: {
          id: 'shop2',
          name: 'Target Shop',
        },
        targetStore: {
          id: 'shop2',
          name: 'Target Shop',
        },
        storeOperations: [
          {
            id: 'store-op-1',
            store: {
              id: 'shop2',
              name: 'Target Shop',
            },
            remoteOperationType: 'IMPORT',
            remoteOperationStatus: 'COMPLETED',
            totalObjectCount: 100,
            completedObjectCount: 100,
            url: 'https://target.myshopify.com/import_result.sqlite',
          },
        ],
      },
    },
  },
}
