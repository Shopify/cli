import GenerateTemplate from './template.js'
import {generateTemplate} from '../../../services/generate/templates.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {renderSelectPrompt, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {cwd} from '@shopify/cli-kit/node/path'
import {fileExists} from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../../utilities/theme-fs.js')
vi.mock('../../../services/generate/templates.js')
vi.mock('@shopify/cli-kit/node/fs')

const path = cwd()
const defaultOptions = {
  path,
  name: 'test',
  extension: 'liquid',
  resource: 'product',
}

describe('GenerateTemplate', () => {
  beforeEach(() => {
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(renderSelectPrompt).mockReset()
    vi.mocked(renderTextPrompt).mockReset()
  })

  describe('template name resolution', () => {
    test('sets name to undefined when base template does not exist', async () => {
      // Given
      vi.mocked(fileExists).mockResolvedValue(false)
      const options = toFlags(defaultOptions)

      // When
      await GenerateTemplate.run(options)

      // Then
      expect(renderTextPrompt).not.toHaveBeenCalled()
      expect(generateTemplate).toHaveBeenCalledWith({
        name: undefined,
        path,
        fileType: 'liquid',
        resource: 'product',
      })
    })

    test('uses provided name when base template exists', async () => {
      // Given
      const options = toFlags({...defaultOptions, name: 'custom'})

      // When
      await GenerateTemplate.run(options)

      // Then
      expect(renderTextPrompt).not.toHaveBeenCalled()
      expect(generateTemplate).toHaveBeenCalledWith({
        name: 'custom',
        path,
        fileType: 'liquid',
        resource: 'product',
      })
    })
  })

  describe('prompting for missing values', () => {
    test('prompts for all values when none provided', async () => {
      // Given
      vi.mocked(renderSelectPrompt)
        .mockResolvedValueOnce('product')
        .mockResolvedValueOnce('liquid')
        .mockResolvedValueOnce('basic')
      const options = toFlags({path})

      // When
      await GenerateTemplate.run(options)

      // Then
      expect(renderSelectPrompt).toHaveBeenCalledWith({
        message: 'Resource type for the template',
        choices: expect.any(Array),
      })
      expect(renderSelectPrompt).toHaveBeenCalledWith({
        message: 'File extension',
        choices: expect.any(Array),
      })
      expect(renderSelectPrompt).toHaveBeenCalledWith({
        message: 'Type of template',
        choices: expect.any(Array),
      })
      expect(generateTemplate).toHaveBeenCalledWith({
        name: undefined,
        path,
        fileType: 'liquid',
        resource: 'product',
      })
    })

    test('only prompts for missing values', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValueOnce('basic')
      const options = toFlags({
        path,
        resource: 'product',
        extension: 'liquid',
      })

      // When
      await GenerateTemplate.run(options)

      // Then
      expect(renderSelectPrompt).toHaveBeenCalledTimes(1)
      expect(renderSelectPrompt).toHaveBeenCalledWith({
        message: 'Type of template',
        choices: expect.any(Array),
      })
      expect(generateTemplate).toHaveBeenCalledWith({
        name: undefined,
        path,
        fileType: 'liquid',
        resource: 'product',
      })
    })
  })

  test('warns and exits if not in theme directory', async () => {
    // Given
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)
    const options = toFlags(defaultOptions)

    // When
    await GenerateTemplate.run(options)

    // Then
    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'The current directory does not contain the required theme directories (config, layout, sections, templates).',
      ],
    })
    expect(generateTemplate).not.toHaveBeenCalled()
  })

  test('proceeds without validation if force flag is used', async () => {
    // Given
    const options = toFlags({
      ...defaultOptions,
      force: true,
    })

    // When
    await GenerateTemplate.run(options)

    // Then
    expect(hasRequiredThemeDirectories).not.toHaveBeenCalled()
    expect(generateTemplate).toHaveBeenCalledWith({
      name: defaultOptions.name,
      path,
      fileType: defaultOptions.extension,
      resource: defaultOptions.resource,
    })
  })
})

function toFlags(options: any) {
  const flags = []
  if (options.path) flags.push('--path', options.path)
  if (options.name) flags.push('--name', options.name)
  if (options.type) flags.push('--type', options.type)
  if (options.extension) flags.push('--extension', options.extension)
  if (options.resource) flags.push('--resource', options.resource)
  if (options.force) flags.push('--force')
  return flags
}
