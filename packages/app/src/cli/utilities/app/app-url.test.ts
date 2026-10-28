import {buildAppURLForAdmin} from './app-url.js'
import {expect, test} from 'vitest'

test('opens the app with the dev console by default', () => {
  expect(buildAppURLForAdmin('test-store.myshopify.com', 'client-id', 'admin.shopify.com')).toBe(
    'https://admin.shopify.com/store/test-store/apps/client-id?dev-console=show',
  )
})

test('opens the app without the dev console when requested', () => {
  expect(buildAppURLForAdmin('test-store.myshopify.com', 'client-id', 'admin.shopify.com', {devConsole: false})).toBe(
    'https://admin.shopify.com/store/test-store/apps/client-id',
  )
})
