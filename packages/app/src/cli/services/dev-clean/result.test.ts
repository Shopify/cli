import {renderDevCleanResult} from './result.js'
import {AppDevCleanResult} from './types.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

test('keeps the dev preview success message', () => {
  const result: AppDevCleanResult = {
    status: 'success',
    app: {name: 'Test App', clientId: 'public-client-id'},
    storeDomain: 'test-store.myshopify.com',
  }
  renderDevCleanResult(result, 'text')
  expect(renderSuccess).toHaveBeenCalledExactlyOnceWith({
    headline: 'Dev preview stopped.',
    body: [
      "The dev preview has been stopped on test-store.myshopify.com and the app's active version has been restored.",
      'You can start it again with',
      {command: 'shopify app dev'},
    ],
  })
})
