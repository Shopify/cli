import {storefrontReplaceTemplatesParams} from './storefront-utils.js'
import {DevServerRenderContext} from './types.js'
import {describe, test, expect} from 'vitest'

const context: DevServerRenderContext = {
  method: 'GET',
  path: '/products/1',
  themeId: '123',
  query: [],
  headers: {
    'Content-Length': '100',
    'X-Special-Header': '200',
    cookie: 'theme_cookie=abc;',
    Cookie: 'theme_cookie=def;',
  },
  replaceTemplates: {},
  sectionId: '',
}

describe('storefrontFormData', () => {
  test("returns the params string with correct mappings for section's content", () => {
    // Given
    const ctx: DevServerRenderContext = {
      ...context,
      replaceTemplates: {
        'sections/announcement-bar.liquid': '<h1>Content</h1>',
      },
    }

    // When
    const formData = storefrontReplaceTemplatesParams(ctx)

    // Then
    const formDataContent = formData.toString()
    expect(formDataContent).toEqual(
      'replace_templates%5Bsections%2Fannouncement-bar.liquid%5D=%3Ch1%3EContent%3C%2Fh1%3E&_method=GET',
    )
  })

  test('handles empty sections record as expected', () => {
    // Given
    const ctx: DevServerRenderContext = {
      ...context,
      replaceTemplates: {},
    }

    // When
    const formData = storefrontReplaceTemplatesParams(ctx)

    // Then
    const formDataContent = formData.toString()
    expect(formDataContent).toEqual('_method=GET')
  })

  test('handles different HTTP method as expected', () => {
    // Given
    const ctx: DevServerRenderContext = {
      ...context,
      method: 'POST',
    }

    // When
    const formData = storefrontReplaceTemplatesParams(ctx)

    // Then
    const formDataContent = formData.toString()
    expect(formDataContent).toEqual('_method=POST')
  })
})
