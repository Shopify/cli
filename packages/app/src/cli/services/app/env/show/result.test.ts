import {formatAppEnvShowText, renderAppEnvShowResult} from './result.js'
import {afterEach, expect, test} from 'vitest'
import {stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

test('formats the text template with the secret when present', () => {
  const result = {SHOPIFY_API_KEY: 'key', SHOPIFY_API_SECRET: 'secret', SCOPES: 'read_products'}

  expect(unstyled(stringifyMessage(formatAppEnvShowText(result)))).toBe(
    '\n    SHOPIFY_API_KEY=key\n    SHOPIFY_API_SECRET=secret\n    SCOPES=read_products\n  ',
  )
})

test('formats the text template with an empty value for an absent secret', () => {
  expect(unstyled(stringifyMessage(formatAppEnvShowText({SHOPIFY_API_KEY: 'key', SCOPES: ''})))).toBe(
    '\n    SHOPIFY_API_KEY=key\n    SHOPIFY_API_SECRET=\n    SCOPES=\n  ',
  )
})

test.each([
  {SHOPIFY_API_KEY: 'key', SHOPIFY_API_SECRET: 'secret', SCOPES: 'read_products'},
  {SHOPIFY_API_KEY: 'key', SCOPES: ''},
])('renders plain JSON omitting absent fields for %j', (result) => {
  const output = mockAndCaptureOutput()

  renderAppEnvShowResult(result, 'json')

  expect(output.output()).toBe(JSON.stringify(result, null, 2))
})

test('renders the text template through the result output', () => {
  const output = mockAndCaptureOutput()

  renderAppEnvShowResult({SHOPIFY_API_KEY: 'key', SCOPES: 'read_products'}, 'text')

  expect(output.output()).toBe('\n    SHOPIFY_API_KEY=key\n    SHOPIFY_API_SECRET=\n    SCOPES=read_products\n  ')
})
