import {command, promptFor} from './helpers.js'
import {Flags} from '@oclif/core'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

const After = command(
  'Build the app',
  {
    'skip-dependencies-installation': Flags.boolean({
      hidden: false,
      description: 'Skips the installation of dependencies.',
      env: 'SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION',
      default: false,
    }),
    'api-key': Flags.string({
      hidden: false,
      description: "Application's API key that will be exposed at build time.",
      env: 'SHOPIFY_FLAG_API_KEY',
    }),
    optional: Flags.string(),
  },
  promptFor([
    {key: 'extra-option', promptFn: async () => 123},
    {key: 'optional', promptFn: async () => 'value'},
  ] as const),
  async (app, allOptions) => {
    renderSuccess({
      headline: 'Declarative command',
      body: JSON.stringify(allOptions),
    })
  },
)

export default After
