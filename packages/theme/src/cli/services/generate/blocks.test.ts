import {generateBlock} from './blocks.js'
import {describe, expect, test, vi} from 'vitest'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('@shopify/cli-kit/node/output')

describe('generateBlock', () => {
  const mockOptions = {
    name: 'test-block',
    type: 'basic',
    path: 'theme',
  } as const

  test('creates a new block file with correct content', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)
    vi.mocked(joinPath).mockReturnValue('theme/blocks/test-block.liquid')

    await generateBlock(mockOptions)

    const expectedContent = `{% schema %}
{
  "name": "test-block",
  "settings": []
}
{% endschema %}`

    expect(writeFile).toHaveBeenCalledWith('theme/blocks/test-block.liquid', expectedContent)
    expect(outputInfo).toHaveBeenCalledWith('Created block: theme/blocks/test-block.liquid')
  })

  test('throws error if block already exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(joinPath).mockReturnValue('theme/blocks/test-block.liquid')

    await expect(generateBlock(mockOptions)).rejects.toThrow(
      'Block test-block already exists at theme/blocks/test-block.liquid',
    )
  })
})
