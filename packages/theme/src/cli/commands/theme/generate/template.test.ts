import GenerateTemplate from './template.js'
import {generateTemplate} from '../../../services/generate/templates.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {renderSelectPrompt, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {cwd} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../../utilities/theme-fs.js')
vi.mock('../../../services/generate/templates.js')

const path = cwd()
const defaultOptions = {
  path,
  name: 'test',
  type: 'basic',
  extension: 'liquid',
  resource: 'product',
}

describe('GenerateTemplate', () => {
  beforeEach(() => {
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
  })

  test('generates a template with provided flags', async () => {
    // Given
    const options = toFlags({...defaultOptions})
    // When
    await GenerateTemplate.run(options)

    // Then
    expect(generateTemplate).toHaveBeenCalledWith({
      name: defaultOptions.name,
      type: defaultOptions.type,
      path: defaultOptions.path,
      fileType: defaultOptions.extension,
      resource: defaultOptions.resource,
    })
  })

  test('prompts for missing flags', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValueOnce('provided name')
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('provided type')
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('provided resource')
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('provided extension')
    const options = toFlags({path})

    // When
    await GenerateTemplate.run(options)

    // Then
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'Name of the template',
    })
    expect(generateTemplate).toHaveBeenCalledWith({
      name: 'provided name',
      type: 'provided type',
      path,
      fileType: 'provided extension',
      resource: 'provided resource',
    })
  })

  test('warns and exits if not in theme directory', async () => {
    // Given
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)
    const options = toFlags({path})

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
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)
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
      type: defaultOptions.type,
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
