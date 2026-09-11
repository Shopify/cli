import {themeInfoJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const themeResult = {
  theme: {
    id: 123,
    name: 'My theme',
    role: 'live',
    shop: 'my-shop.myshopify.com',
    preview_url: 'https://my-shop.myshopify.com/preview',
    editor_url: 'https://my-shop.myshopify.com/editor',
  },
}

const environmentResult = {
  store: 'my-shop.myshopify.com',
  development_theme_id: null,
  cli_version: '3.91.0',
  os: 'darwin-arm64',
  shell: '/bin/zsh',
  node_version: 'v24.15.0',
}

describe('themeInfoJsonOutputSchema', () => {
  test.each([themeResult, environmentResult])('validates the existing result shape', (result) => {
    expect(themeInfoJsonOutputSchema.validate(result)).toEqual(result)
  })

  test('rejects a theme result with an invalid theme ID', () => {
    expect(() =>
      themeInfoJsonOutputSchema.validate({...themeResult, theme: {...themeResult.theme, id: '123'}}),
    ).toThrow()
  })

  test('rejects an environment result with an invalid development theme ID', () => {
    expect(() => themeInfoJsonOutputSchema.validate({...environmentResult, development_theme_id: '123'})).toThrow()
  })
})
