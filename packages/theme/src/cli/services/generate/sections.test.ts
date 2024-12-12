import {generateSection} from './sections.js'
import {describe, expect, test, vi} from 'vitest'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('@shopify/cli-kit/node/output')

describe('generateSection', () => {
  const mockLiquidOptions = {
    name: 'test-section',
    type: 'featured-collection',
    path: 'theme',
    fileType: 'liquid',
  } as const

  const mockJsonOptions = {
    name: 'test-section',
    type: 'featured-collection',
    path: 'theme',
    fileType: 'json',
  } as const

  test('creates a new liquid section file with correct content', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)
    vi.mocked(joinPath).mockReturnValue('theme/sections/test-section.liquid')

    await generateSection(mockLiquidOptions)

    const expectedContent = `{% schema %}
{
  "name": "test-section",
  "settings": []
}
{% endschema %}`

    expect(writeFile).toHaveBeenCalledWith('theme/sections/test-section.liquid', expectedContent)
    expect(outputInfo).toHaveBeenCalledWith('Created section: theme/sections/test-section.liquid')
  })

  test('creates a new json section file with correct content', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)
    vi.mocked(joinPath).mockReturnValue('theme/sections/test-section.json')

    await generateSection(mockJsonOptions)

    const expectedContent = JSON.stringify(
      {
        type: 'header',
        name: 'test-section',
        settings: [],
        order: [],
      },
      null,
      2,
    )

    expect(writeFile).toHaveBeenCalledWith('theme/sections/test-section.json', expectedContent)
    expect(outputInfo).toHaveBeenCalledWith('Created section: theme/sections/test-section.json')
  })

  test('throws error if liquid section already exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(joinPath).mockReturnValue('theme/sections/test-section.liquid')

    await expect(generateSection(mockLiquidOptions)).rejects.toThrow(
      'Section test-section already exists at theme/sections/test-section.liquid',
    )
  })

  test('throws error if json section already exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(joinPath).mockReturnValue('theme/sections/test-section.json')

    await expect(generateSection(mockJsonOptions)).rejects.toThrow(
      'Section test-section already exists at theme/sections/test-section.json',
    )
  })

  test('throws error if another section already exists with the same name but a different file type', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(joinPath).mockReturnValue('theme/sections/test-section.liquid')

    await expect(generateSection(mockLiquidOptions)).rejects.toThrow(
      'Section test-section already exists at theme/sections/test-section.liquid',
    )
  })
})
