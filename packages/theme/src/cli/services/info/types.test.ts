import {themeInfoJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const theme = {
  id: '123',
  name: 'My theme',
  role: 'main',
  storeDomain: 'my-shop.myshopify.com',
  previewUrl: 'https://my-shop.myshopify.com/preview',
  editorUrl: 'https://my-shop.myshopify.com/editor',
}

describe('themeInfoJsonOutputSchema', () => {
  test('validates a strict public projection with string IDs', () => {
    expect(themeInfoJsonOutputSchema.validate({theme})).toEqual({theme})
    expect(() => themeInfoJsonOutputSchema.validate({theme: {...theme, id: 123}})).toThrow()
    expect(() => themeInfoJsonOutputSchema.validate({theme: {...theme, createdAtRuntime: false}})).toThrow()
    expect(() => themeInfoJsonOutputSchema.validate({theme: {...theme, storeDomain: 'custom.example.com'}})).toThrow()
  })

  test('accepts one complete batch including errors and cancellations', () => {
    const result = {
      environments: [
        {environment: 'first', result: {theme}},
        {environment: 'second', error: {type: 'abort', message: 'Authentication failed'}},
        {environment: 'third', result: {status: 'cancelled'}},
      ],
    }
    expect(themeInfoJsonOutputSchema.validate(result)).toEqual(result)
  })

  test('encodes unavailable store and shell values as null', () => {
    expect(
      JSON.parse(
        themeInfoJsonOutputSchema.encode({
          store: 'Not configured',
          development_theme_id: null,
          cli_version: '3.91.0',
          os: 'darwin-arm64',
          shell: 'unknown',
          node_version: 'v24.15.0',
        }),
      ),
    ).toEqual({
      storeDomain: null,
      developmentThemeId: null,
      cliVersion: '3.91.0',
      os: 'darwin-arm64',
      shell: null,
      nodeVersion: 'v24.15.0',
    })
  })
})
