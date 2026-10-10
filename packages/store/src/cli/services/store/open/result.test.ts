import {renderOpenStoreResult} from './result.js'
import {openStoreJsonOutputSchema} from './types.js'
import {beforeEach, expect, test, vi} from 'vitest'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')

beforeEach(() => {
  mockAndCaptureOutput().clear()
})

test.each([true, false])('encodes browser opening status %s without losing the preview URL', (opened) => {
  const result = {storeDomain: 'preview.myshopify.com', url: 'https://preview.myshopify.com/?token=abc', opened}
  expect(JSON.parse(openStoreJsonOutputSchema.encode(result))).toEqual(result)
})

test('rejects an invalid browser opening status', () => {
  expect(() =>
    openStoreJsonOutputSchema.validate({
      storeDomain: 'shop.myshopify.com',
      url: 'https://shop.myshopify.com',
      opened: 'false',
    }),
  ).toThrow()
})

test('preserves the browser opening message', () => {
  renderOpenStoreResult({storeDomain: 'shop.myshopify.com', url: 'https://shop.myshopify.com', opened: true}, 'text')
  expect(renderInfo).toHaveBeenCalledWith({headline: 'Opening the storefront for shop.myshopify.com in your browser.'})
})

test('preserves the fallback message and URL', () => {
  renderOpenStoreResult({storeDomain: 'shop.myshopify.com', url: 'https://shop.myshopify.com', opened: false}, 'text')
  expect(renderInfo).toHaveBeenCalledWith({
    headline: "Browser didn't open automatically. Open the storefront manually:",
    body: [expect.stringContaining('https://shop.myshopify.com')],
  })
})

test('outputs the JSON result without a terminal banner', () => {
  const output = mockAndCaptureOutput()
  const result = {storeDomain: 'shop.myshopify.com', url: 'https://shop.myshopify.com', opened: false}

  renderOpenStoreResult(result, 'json')

  expect(JSON.parse(output.output())).toEqual(result)
  expect(renderInfo).not.toHaveBeenCalled()
})
