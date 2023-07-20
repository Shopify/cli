import {createStep} from '../utils/utils.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default createStep('success', success)

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function success(options: any) {
  renderSuccess({
    headline: `${options.configFileName} is now linked to "${options.remoteApp.title}" on Shopify`,
    body: `Using ${options.configFileName} as your default config.`,
    nextSteps: [
      [`Make updates to ${options.configFileName} in your local project`],
      ['To upload your config, run', {command: 'shopify app config push'}],
    ],
    reference: [
      {
        link: {
          label: 'App configuration',
          url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
        },
      },
    ],
  })

  return options
}
