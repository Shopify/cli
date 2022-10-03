import {renderError, renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

export async function kitchenSink() {
  renderInfo({
    headline: 'Title',
    body: 'Body',
    nextSteps: [
      'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua',
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat',
    ],
    reference: ['Reference 1', 'Reference 2'],
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
    headline: 'Title',
    body: 'Body',
    nextSteps: [
      'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua',
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat',
    ],
  })
}
