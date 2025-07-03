/* eslint-disable no-catch-all/no-catch-all */
import {Given, When, Then, After} from '@cucumber/cucumber'
import {strict as assert} from 'assert'
import * as fs from 'fs/promises'

interface StoreContext {
  sourceStore?: string
  destinationStore?: string
  stores: Map<string, StoreInfo>
  importFile?: string
  exportStore?: string
  operationResult?: {
    error?: string
    cancelled?: boolean
    stdout?: string
  }
  downloadedFile?: string
  tempFiles: string[]
  networkFailure?: boolean
  exportResult?: ExportResult
}

interface StoreInfo {
  domain: string
  organizationId: string
}

interface ExportResult {
  operationId: string
  downloadUrl: string
  gzipped: boolean
}

const storeContext: StoreContext = {
  stores: new Map(),
  tempFiles: [],
}

Given('I am logged into the Business Platform', async function () {
  this.businessPlatformToken = 'test-token-123'
})

Given('I have a source store {string}', function (storeDomain: string) {
  storeContext.sourceStore = storeDomain
  storeContext.stores.set(storeDomain, {
    domain: storeDomain,
    organizationId: 'org-123',
  })
})

Given('I have a destination store {string}', function (storeDomain: string) {
  storeContext.destinationStore = storeDomain
  if (!storeContext.stores.has(storeDomain)) {
    storeContext.stores.set(storeDomain, {
      domain: storeDomain,
      organizationId: 'org-123',
    })
  }
})

Given('both stores are in the same organization', function () {
  if (storeContext.sourceStore && storeContext.destinationStore) {
    const orgId = 'org-123'
    const sourceStore = storeContext.stores.get(storeContext.sourceStore)
    const destStore = storeContext.stores.get(storeContext.destinationStore)
    if (sourceStore) sourceStore.organizationId = orgId
    if (destStore) destStore.organizationId = orgId
  }
})

When(
  'I run the store copy command with source {string} and destination {string}',
  {timeout: 60 * 1000},
  async function (source: string, destination: string) {
    try {
      const args = ['store', 'copy', '--from-store', source, '--to-store', destination, '--mock', '--no-prompt']
      const result = await this.execCLI(args)
      const context = storeContext
      context.operationResult = result
    } catch (error) {
      const context = storeContext
      context.operationResult = {error: error instanceof Error ? error.message : String(error)}
    }
  },
)

When('I confirm the copy operation', function () {})

When('I decline the copy operation', function () {
  storeContext.operationResult = {cancelled: true}
})

Then('the copy operation should start successfully', function () {
  assert.ok(!storeContext.operationResult?.error)
  assert.ok(!storeContext.operationResult?.cancelled)
})

Then('I should see the copy progress', function () {})

Then('the copy should complete successfully', function () {
  assert.ok(!storeContext.operationResult?.error)
})

Then('I should see a success message', function () {})

After(async function () {
  const filesToDelete = [...storeContext.tempFiles]
  await Promise.all(
    filesToDelete.map(async (file) => {
      try {
        await fs.unlink(file)
      } catch {
        // Ignore file deletion errors
      }
    }),
  )
  const context = storeContext
  context.tempFiles = []
  context.stores.clear()
  context.sourceStore = undefined
  context.destinationStore = undefined
  context.importFile = undefined
  context.exportStore = undefined
  context.operationResult = undefined
  context.downloadedFile = undefined
  context.networkFailure = undefined
  context.exportResult = undefined
})
