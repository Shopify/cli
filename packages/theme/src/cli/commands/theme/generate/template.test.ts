import GenerateTemplate from './template.js'
import {hasRequiredThemeDirectories} from '../../../utilities/theme-fs.js'
import {describe, expect, test, vi} from 'vitest'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {cwd} from '@shopify/cli-kit/node/path'

vi.mock('../../../utilities/theme-fs.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('GenerateTemplate', () => {
  const path = cwd()
  test('validates theme directory structure by default', async () => {
    // Given
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)

    // When
    await GenerateTemplate.run(['--path', path])

    // Then
    expect(hasRequiredThemeDirectories).toHaveBeenCalledWith(path)
    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'The current directory does not contain the required theme directories (config, layout, sections, templates).',
      ],
    })
  })

  test('skips directory validation when force flag is used', async () => {
    // Given
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)

    // When
    await GenerateTemplate.run(['--path', path, '--force'])

    // Then
    expect(hasRequiredThemeDirectories).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })
})
