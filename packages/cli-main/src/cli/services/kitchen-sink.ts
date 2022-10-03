import {error} from '@shopify/cli-kit'
import {renderError, renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export async function kitchenSink() {
  renderInfo({
    headline: 'Title',
    body: 'Body',
    nextSteps: [
      {
        text: 'Run',
        command: 'cd santorini-goods',
      },
      {
        text: 'To preview your project, run',
        command: 'npm app dev',
      },
      {
        text: 'To add extensions, run',
        command: 'npm generate extension',
      },
    ],
    reference: [
      {text: 'Run', command: 'npm shopify help'},
      {
        text: "Press 'return' to open the",
        link: {
          label: 'dev docs',
          url: 'https://shopify.dev',
        },
      },
    ],
    link: {
      label: 'Link',
      url: 'https://shopify.com',
    },
  })

  renderSuccess({
    body: 'Body',
  })

  renderWarning({
    body: 'Body',
    reference: ['Reference 1', 'Reference 2'],
  })

  renderError({
    error: new error.Abort(
      "Couldn't connect to the Shopify Partner Dashboard.",
      'Check your internet connection and try again.',
    ),
  })
}
