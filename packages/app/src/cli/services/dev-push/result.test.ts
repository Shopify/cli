import {renderDevPushResult} from './result.js'
import {appDevPushJsonOutputSchema, DevPushResult} from './types.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

const result: DevPushResult = {
  status: 'success',
  app: {name: 'Test app', clientId: 'public-client-id'},
  storeDomain: 'test-store.myshopify.com',
  appUrl: 'https://preview.example.com',
  previewUrl: 'https://admin.shopify.com/store/test-store/apps/public-client-id',
  warnings: [{code: 'SESSION_TAKEOVER', message: 'Another preview was replaced'}],
}

test('JSON includes warnings in one result without terminal banners', async () => {
  await withCapturedStandardStreams(async ({stdout}) => {
    renderDevPushResult(result, 'json')
    expect(JSON.parse(stdout())).toEqual(result)
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })
})

test('text reports server warnings, the preview link, and how to restore the released version', () => {
  renderDevPushResult(result, 'text')
  expect(renderWarning).toHaveBeenCalledWith({headline: 'Another preview was replaced'})
  expect(renderSuccess).toHaveBeenCalledWith({
    headline: 'Dev preview created.',
    body: 'A snapshot of Test app is active on test-store.myshopify.com.',
    nextSteps: [
      [{link: {label: 'Open the app preview', url: result.previewUrl}}],
      ['Run', {command: 'shopify app dev clean'}, "to restore the app's released version."],
    ],
  })
})

test('the public result schema rejects incidental extra fields', () => {
  expect(() => appDevPushJsonOutputSchema.encode({...result, accessToken: 'secret'} as never)).toThrow()
})
