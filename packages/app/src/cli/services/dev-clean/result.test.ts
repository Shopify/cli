import {renderDevCleanResult} from './result.js'
import {DevCleanResult} from './types.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

test('keeps the dev preview success message', () => {
  const result: DevCleanResult = {
    status: 'success',
    app: {name: 'Test App', clientId: 'public-client-id'},
    storeHostname: 'test-store.myshopify.com',
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

test('an unknown canonical store domain is null in JSON and retains its hostname in text', async () => {
  const result: DevCleanResult = {
    status: 'success',
    app: {name: 'Test App', clientId: 'public-client-id'},
    storeHostname: 'test-store.my.shop.dev',
  }
  await withCapturedStandardStreams(async ({stdout}) => {
    renderDevCleanResult(result, 'json')
    expect(JSON.parse(stdout())).toMatchObject({storeDomain: null})
  })
  renderDevCleanResult(result, 'text')
  expect(renderSuccess).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.arrayContaining([
        "The dev preview has been stopped on test-store.my.shop.dev and the app's active version has been restored.",
      ]),
    }),
  )
})
