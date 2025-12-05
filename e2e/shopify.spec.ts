import {test, expect} from '@playwright/test'

test('shopify.com returns 200', async ({page}) => {
  const response = await page.goto('https://shopify.com')

  expect(response?.status()).toBe(200)
})

test('localhost returns 200', async ({page}) => {
  const response = await page.goto('http://localhost:9292')

  expect(response?.status()).toBe(200)
  const locator = page.locator('header h1')
  await expect(locator).toHaveText('TeamTWS')
})
