import {formatAppEnvShowText, renderAppEnvShowResult} from './result.js'
import {afterEach, expect, test} from 'vitest'
import {stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

test('formats the text template with the secret when present', () => {
  const result = {
    variables: [
      {name: 'SHOPIFY_API_KEY', value: 'key'},
      {name: 'SHOPIFY_API_SECRET', value: 'secret'},
      {name: 'SCOPES', value: 'read_products'},
    ],
  }

  expect(unstyled(stringifyMessage(formatAppEnvShowText(result)))).toBe(
    '\n    SHOPIFY_API_KEY=key\n    SHOPIFY_API_SECRET=secret\n    SCOPES=read_products\n  ',
  )
})

test('formats the text template with an empty value for an absent secret', () => {
  expect(
    unstyled(
      stringifyMessage(
        formatAppEnvShowText({
          variables: [
            {name: 'SHOPIFY_API_KEY', value: 'key'},
            {name: 'SCOPES', value: ''},
          ],
        }),
      ),
    ),
  ).toBe('\n    SHOPIFY_API_KEY=key\n    SHOPIFY_API_SECRET=\n    SCOPES=\n  ')
})

test.each([
  {
    variables: [
      {name: 'SHOPIFY_API_KEY', value: 'key'},
      {name: 'SHOPIFY_API_SECRET', value: 'secret'},
      {name: 'SCOPES', value: 'read_products'},
    ],
  },
  {
    variables: [
      {name: 'SHOPIFY_API_KEY', value: 'key'},
      {name: 'SCOPES', value: ''},
    ],
  },
])('renders plain JSON omitting absent fields for %j', (result) => {
  const output = mockAndCaptureOutput()

  renderAppEnvShowResult(result, 'json')

  expect(output.output()).toBe(JSON.stringify(result, null, 2))
})

test('renders the text template through the result output', () => {
  const output = mockAndCaptureOutput()

  renderAppEnvShowResult(
    {
      variables: [
        {name: 'SHOPIFY_API_KEY', value: 'key'},
        {name: 'SCOPES', value: 'read_products'},
      ],
    },
    'text',
  )

  expect(output.output()).toBe('\n    SHOPIFY_API_KEY=key\n    SHOPIFY_API_SECRET=\n    SCOPES=read_products\n  ')
})

test('accepts empty collections and names-only records without adding unknown metadata', () => {
  const output = mockAndCaptureOutput()
  const result = {variables: [{name: 'Mixed_Case'}]}
  renderAppEnvShowResult(result, 'json')
  expect(JSON.parse(output.output())).toEqual(result)
  output.clear()
  renderAppEnvShowResult({variables: []}, 'json')
  expect(JSON.parse(output.output())).toEqual({variables: []})
})
