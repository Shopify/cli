import {postrun} from './deprecations.js'
import {getNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {renderWarning} from '../ui.js'
import {Command} from '@oclif/core'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('../../../private/node/context/deprecations-store.js')
vi.mock('../ui.js')

describe('postrun', () => {
  beforeEach(() => {
    vi.mocked(getNextDeprecationDate).mockReturnValue(undefined)
    vi.mocked(renderWarning).mockClear()
  })

  test('does nothing if getNextDeprecationDate returns undefined', () => {
    // Given
    const mockCommand = {
      id: 'app:dev',
    } as Command.Class

    // When
    postrun(mockCommand)

    // Then
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders upgrade warning for non-theme command', () => {
    // Given
    const deprecationDate = new Date('2025-12-31T00:00:00Z')
    vi.mocked(getNextDeprecationDate).mockReturnValue(deprecationDate)
    const mockCommand = {
      id: 'app:dev',
    } as Command.Class

    // When
    postrun(mockCommand)

    // Then
    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('December 31, 2025'),
        body: 'This command requires an upgrade to continue working as intended.',
        nextSteps: [
          [
            'Run',
            {command: 'upgrade'},
            'to',
            {
              link: {
                label: 'upgrade Shopify CLI',
                url: 'https://shopify.dev/docs/apps/tools/cli#upgrade-shopify-cli',
              },
            },
          ],
        ],
      }),
    )
  })

  test('renders upgrade warning for theme command', () => {
    // Given
    const deprecationDate = new Date('2025-12-31T00:00:00Z')
    vi.mocked(getNextDeprecationDate).mockReturnValue(deprecationDate)
    const mockCommand = {
      id: 'theme:dev',
    } as Command.Class

    // When
    postrun(mockCommand)

    // Then
    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('December 31, 2025'),
        body: 'This command requires an upgrade to continue working as intended.',
        nextSteps: [
          [
            'Run',
            {command: 'upgrade'},
            'to',
            {
              link: {
                label: 'upgrade Shopify CLI',
                url: 'https://shopify.dev/docs/themes/tools/cli#upgrade-shopify-cli',
              },
            },
          ],
        ],
      }),
    )
  })
})
