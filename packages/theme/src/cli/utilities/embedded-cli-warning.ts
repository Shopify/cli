import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export function showEmbeddedCLIWarning() {
  if (!useEmbeddedThemeCLI()) {
    renderWarning({
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
  }
}
