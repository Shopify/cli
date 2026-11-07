import {
  testAppLinked,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../models/app/app.test-data.js'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'

export function testBulkOperation(overrides: Partial<BulkOperation> = {}): BulkOperation {
  return {
    id: 'gid://shopify/BulkOperation/123',
    type: 'QUERY',
    status: 'RUNNING',
    errorCode: null,
    objectCount: '2',
    createdAt: '2026-09-01T00:00:00Z',
    completedAt: null,
    url: null,
    partialDataUrl: null,
    ...overrides,
  }
}

export function testBulkOperationContext() {
  const remoteApp = testOrganizationApp()
  return {
    appContextResult: {
      app: testAppLinked(),
      remoteApp,
      developerPlatformClient: remoteApp.developerPlatformClient,
      organization: testOrganization(),
      specifications: [],
      project: testProject(),
      activeConfig: {} as never,
    },
    store: testOrganizationStore({shopDomain: 'shop.myshopify.com'}),
  }
}
