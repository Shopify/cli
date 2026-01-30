import {
  mapFieldTypeToTypeScript,
  extractMetaobjectsConfig,
  generateMetaobjectTypeDefinitions,
  generateMetaobjectTypes,
} from './metaobject-types.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

describe('metaobject-types', () => {
  describe('mapFieldTypeToTypeScript', () => {
    test('maps single_line_text_field to string', () => {
      expect(mapFieldTypeToTypeScript('single_line_text_field')).toBe('string')
    })

    test('maps multi_line_text_field to string', () => {
      expect(mapFieldTypeToTypeScript('multi_line_text_field')).toBe('string')
    })

    test('maps metaobject_reference types to string', () => {
      expect(mapFieldTypeToTypeScript('metaobject_reference<$app:author>')).toBe('string')
    })

    test('maps unknown types to any', () => {
      expect(mapFieldTypeToTypeScript('unknown_type')).toBe('any')
      expect(mapFieldTypeToTypeScript('number_field')).toBe('any')
    })
  })

  describe('extractMetaobjectsConfig', () => {
    test('extracts metaobjects from configuration', () => {
      const config = {
        metaobjects: {
          app: {
            author: {
              fields: {
                name: 'single_line_text_field',
              },
            },
          },
        },
      }

      const result = extractMetaobjectsConfig(config)

      expect(result).toEqual(config.metaobjects)
    })

    test('returns undefined when no metaobjects', () => {
      const config = {name: 'My App'}

      const result = extractMetaobjectsConfig(config)

      expect(result).toBeUndefined()
    })
  })

  describe('generateMetaobjectTypeDefinitions', () => {
    test('returns undefined when metaobjects is undefined', () => {
      expect(generateMetaobjectTypeDefinitions(undefined)).toBeUndefined()
    })

    test('returns undefined when metaobjects.app is undefined', () => {
      expect(generateMetaobjectTypeDefinitions({})).toBeUndefined()
    })

    test('returns undefined when metaobjects.app is empty', () => {
      expect(generateMetaobjectTypeDefinitions({app: {}})).toBeUndefined()
    })

    test('generates types for short-form fields', () => {
      const metaobjects = {
        app: {
          author: {
            fields: {
              name: 'single_line_text_field',
              bio: 'multi_line_text_field',
            },
          },
        },
      }

      const result = generateMetaobjectTypeDefinitions(metaobjects)

      expect(result).toContain('"$app:author"')
      expect(result).toContain('name: string')
      expect(result).toContain('bio: string')
    })

    test('generates types for long-form fields', () => {
      const metaobjects = {
        app: {
          post: {
            fields: {
              title: {type: 'single_line_text_field'},
              author: {type: 'metaobject_reference<$app:author>'},
            },
          },
        },
      }

      const result = generateMetaobjectTypeDefinitions(metaobjects)

      expect(result).toContain('"$app:post"')
      expect(result).toContain('title: string')
      expect(result).toContain('author: string')
    })

    test('generates types for multiple metaobject types', () => {
      const metaobjects = {
        app: {
          author: {
            fields: {
              name: 'single_line_text_field',
            },
          },
          post: {
            fields: {
              title: 'single_line_text_field',
            },
          },
        },
      }

      const result = generateMetaobjectTypeDefinitions(metaobjects)

      expect(result).toContain('"$app:author"')
      expect(result).toContain('"$app:post"')
    })

    test('maps unknown field types to any', () => {
      const metaobjects = {
        app: {
          item: {
            fields: {
              count: 'number_field',
            },
          },
        },
      }

      const result = generateMetaobjectTypeDefinitions(metaobjects)

      expect(result).toContain('count: any')
    })

    test('generates correct TypeScript structure', () => {
      const metaobjects = {
        app: {
          author: {
            fields: {
              name: 'single_line_text_field',
            },
          },
        },
      }

      const result = generateMetaobjectTypeDefinitions(metaobjects)

      expect(result).toContain('declare global {')
      expect(result).toContain('interface ShopifyGlobalOverrides {')
      expect(result).toContain('metaobjectTypes: {')
      expect(result).toContain('export {}')
    })
  })

  describe('generateMetaobjectTypes', () => {
    beforeEach(() => {
      vi.mocked(fs.fileExistsSync).mockReturnValue(false)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {})
      vi.mocked(fs.removeFileSync).mockImplementation(() => {})
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(''))
    })

    afterEach(() => {
      vi.resetAllMocks()
    })

    test('writes type file when metaobjects are defined', async () => {
      const config = {
        metaobjects: {
          app: {
            author: {
              fields: {
                name: 'single_line_text_field',
              },
            },
          },
        },
      }

      await generateMetaobjectTypes(config, '/app')

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/app/app-bridge.d.ts',
        expect.stringContaining('"$app:author"'),
      )
    })

    test('removes type file when no metaobjects and file exists', async () => {
      vi.mocked(fs.fileExistsSync).mockReturnValue(true)
      const config = {name: 'My App'}

      await generateMetaobjectTypes(config, '/app')

      expect(fs.removeFileSync).toHaveBeenCalledWith('/app/app-bridge.d.ts')
    })

    test('does nothing when no metaobjects and file does not exist', async () => {
      vi.mocked(fs.fileExistsSync).mockReturnValue(false)
      const config = {name: 'My App'}

      await generateMetaobjectTypes(config, '/app')

      expect(fs.removeFileSync).not.toHaveBeenCalled()
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    test('does not write if content is unchanged', async () => {
      const config = {
        metaobjects: {
          app: {
            author: {
              fields: {
                name: 'single_line_text_field',
              },
            },
          },
        },
      }

      const expectedContent = `declare global {
  interface ShopifyGlobalOverrides {
    metaobjectTypes: {
      "$app:author": { name: string };
    }
  }
}
export {}
`
      vi.mocked(fs.fileExistsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(expectedContent))

      await generateMetaobjectTypes(config, '/app')

      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })
  })
})
