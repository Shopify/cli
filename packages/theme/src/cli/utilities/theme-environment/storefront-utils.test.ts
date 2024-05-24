import {storefrontReplaceTemplatesParams} from './storefront-utils.js'
import {describe, test, expect} from 'vitest'

describe('storefrontFormData', () => {
  test("returns the params string with correct mappings for section's content", () => {
    // Given
    const sections = {
      'sections/announcement-bar.liquid': '<h1>Content</h1>',
    }

    // When
    const formData = storefrontReplaceTemplatesParams(sections)

    // Then
    const formDataContent = formData.toString()
    expect(formDataContent).toEqual(
      'replace_templates%5Bsections%2Fannouncement-bar.liquid%5D=%3Ch1%3EContent%3C%2Fh1%3E&_method=GET',
    )
  })

  test('handles empty sections record as expected', () => {
    // Given
    const sectionsContent = {}

    // When
    const formData = storefrontReplaceTemplatesParams(sectionsContent)

    // Then
    const formDataContent = formData.toString()
    expect(formDataContent).toEqual('_method=GET')
  })
})
