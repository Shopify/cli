import {logBulkOperationStart} from './progress.js'
import {testBulkOperationContext} from './bulk-operation.test-data.js'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

function context() {
  const {appContextResult, store} = testBulkOperationContext()
  return {
    organization: appContextResult.organization,
    remoteApp: appContextResult.remoteApp,
    storeFqdn: store.shopDomain,
    version: '2026-01',
    operationId: 'gid://shopify/BulkOperation/123',
  }
}

test('preserves the text banner and its context', () => {
  const input = context()
  logBulkOperationStart('Starting bulk operation.', input, 'text')
  expect(renderInfo).toHaveBeenCalledWith({
    headline: 'Starting bulk operation.',
    body: [
      {
        list: {
          items: [
            'ID: gid://shopify/BulkOperation/123',
            `Organization: ${input.organization.businessName}`,
            `App: ${input.remoteApp.title}`,
            'Store: shop.myshopify.com',
            'API version: 2026-01',
          ],
        },
      },
    ],
  })
})

test('JSON diagnostics use the event channel on stderr without rendering a banner', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    runWithCommandEventsForCommand(['--json'], () => {
      logBulkOperationStart('Starting bulk operation.', context(), 'json')
    })
    expect(stdout()).toBe('')
    expect(JSON.parse(stderr())).toMatchObject({
      type: 'diagnostic',
      level: 'info',
      message: expect.stringContaining('Starting bulk operation.'),
    })
    expect(renderInfo).not.toHaveBeenCalled()
  })
})
