import {error} from '@shopify/cli-kit'
import {renderError, renderFatalError, renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export async function kitchenSink() {
  renderInfo({
    headline: 'Title',
    body: 'Body',
    nextSteps: [
      [
        'Run',
        {
          command: 'cd santorini-goods',
        },
      ],
      [
        'To preview your project, run',
        {
          command: 'npm app dev',
        },
      ],
      [
        'To add extensions, run',
        {
          command: 'npm generate extension',
        },
      ],
    ],
    reference: [
      [
        'Run',
        {
          command: 'npm shopify help',
        },
      ],
      [
        "Press 'return' to open the",
        {
          link: {
            label: 'dev docs',
            url: 'https://shopify.dev',
          },
        },
      ],
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
    nextSteps: ['First', 'Second'],
    orderedNextSteps: true,
  })

  renderFatalError(
    new error.Abort(
      "Couldn't connect to the Shopify Partner Dashboard.",
      'Check your internet connection and try again.',
    ),
  )

  renderFatalError(new error.Bug('Unexpected error'))

  renderError({
    headline: 'Something went wrong.',
    tryMessages: ['Check your internet connection.', 'Try again.'],
  })
}
