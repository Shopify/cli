import {showEmbeddedCLIWarning} from './embedded-cli-warning.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {test, describe, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local')

describe('#showEmbeddedCLIWarning', () => {
  test("shows warning message when the user isn't using the embedded CLI", async () => {
    // Given
    vi.mocked(useEmbeddedThemeCLI).mockReturnValue(false)

    // When
    showEmbeddedCLIWarning()

    // Then
    expect(renderWarning).toBeCalledWith({
      headline: ['`SHOPIFY_CLI_BUNDLED_THEME_CLI` is deprecated.'],
      body: [
        'The',
        {
          command: 'SHOPIFY_CLI_BUNDLED_THEME_CLI',
        },
        'environment variable has been deprecated and should be used for debugging purposes only. If this variable is essential to your workflow, please report an issue at',
        {
          link: {
            url: 'https://github.com/Shopify/cli/issues',
          },
        },
        {
          char: '.',
        },
      ],
    })
  })

  test("doesn't show warning message when the user is using the embedded CLI", async () => {
    // Given
    vi.mocked(useEmbeddedThemeCLI).mockReturnValue(true)

    // When
    showEmbeddedCLIWarning()

    // Then
    expect(renderWarning).not.toBeCalled()
  })
})
