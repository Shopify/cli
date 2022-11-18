import {getHTML, getTemplatesDirectory, Template, TemplateNotFoundError} from './templates.js'
import {describe, expect, test} from 'vitest'

describe('getTemplatesDirectory', () => {
  test('returns a the directory path', async () => {
    // Given/When
    const got = await getTemplatesDirectory()

    // Then
    expect(got).not.toEqual('')
  })
})

describe('getHTML', () => {
  test.each([['post_purchase', 'index']])(
    `returns the HTML for extension surface %s and template %s`,
    async (extensionSurface, template) => {
      // Given/When
      const got = await getHTML({
        extensionSurface,
        template: template as Template,
        data: {},
      })
    },
  )

  test.each([['post_purchase', 'invalid']])(
    `throws a TemplateNotFoundError error when returning the HTML for extension type %s and template %s`,
    async (extensionSurface, template) => {
      // Given
      const options = {
        extensionSurface,
        template: template as Template,
        data: {},
      }

      await expect(async () => {
        await getHTML(options)
      }).rejects.toThrowError(new TemplateNotFoundError(options))
    },
  )
})
