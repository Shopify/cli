import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {
  renderError,
  renderFakeDev,
  renderFatalError,
  renderInfo,
  renderSuccess,
  renderTable,
  renderWarning,
} from '@shopify/cli-kit/node/ui'

export async function staticService() {
  renderFakeDev()
  return

  // Banners
  renderInfo({
    headline: 'CLI update available.',
    body: ['Run', {command: 'npm run shopify upgrade'}, {char: '.'}],
  })

  renderInfo({
    headline: [
      'To connect this project to your shopify store cd into:',
      {filePath: '/my-store/hydrogen.config.js'},
      {char: '.'},
    ],
    body: [
      'You can also try the following steps:',
      {
        list: {
          items: [
            ['Run', {command: 'shopify project connect'}],
            ['Run', {command: 'hydrogen start'}],
          ],
        },
      },
    ],
  })

  renderInfo({
    headline: 'About your app',
    customSections: [
      {
        body: {
          tabularData: [
            ['Configuration file', {filePath: 'shopify.app.scalable-transaction-app.toml'}],
            ['App name', {userInput: 'scalable-transaction-app'}],
            ['Access scopes', 'read_products,write_products'],
          ],
          firstColumnSubdued: true,
        },
      },
    ],
  })

  renderInfo({
    headline: [{userInput: 'my-app'}, 'initialized and ready to build.'],
    nextSteps: [
      [
        'Run',
        {
          command: 'cd verification-app',
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
      {
        link: {
          label: 'Dev docs',
          url: 'https://shopify.dev',
        },
      },
    ],
    customSections: [
      {
        title: 'Custom section',
        body: {
          list: {
            items: [
              {link: {label: 'Item 1', url: 'https://shopify.com'}},
              'Item 2',
              {link: {url: 'https://community.shopify.com/'}},
            ],
          },
        },
      },
      {
        title: 'Custom section 2',
        body: {
          list: {
            items: ['Item 1', 'Item 2', 'Item 3'],
          },
        },
      },
    ],
  })

  renderSuccess({
    headline: 'CLI updated.',
    body: 'You are now running version 3.47.',
  })

  renderSuccess({
    headline: 'Deployment successful.',
    body: 'Your extensions have been uploaded to your Shopify Partners Dashboard.',
    nextSteps: [
      {
        link: {
          label: 'See your deployment and set it live',
          url: 'https://partners.shopify.com/1797046/apps/4523695/deployments',
        },
      },
    ],
  })

  renderWarning({
    headline: 'You have reached your limit of checkout extensions for this app.',
    body: 'You can free up space for a new one by deleting an existing one.',
  })

  renderWarning({
    headline: 'Required access scope update.',
    body: 'The deadline for re-selecting your app scopes is May 1, 2022.',
    reference: [
      {
        link: {
          label: 'Dev docs',
          url: 'https://shopify.dev/app/scopes',
        },
      },
    ],
  })

  // Stack trace
  const somethingWentWrong = new BugError('Something went wrong.')

  somethingWentWrong.stack = `
  Error: Unexpected error
      at Module._compile (internal/modules/cjs/loader.js:1137:30)
      at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)
      at Module.load (internal/modules/cjs/loader.js:985:32)
      at Function.Module._load (internal/modules/cjs/loader.js:878:14)
`

  renderFatalError(somethingWentWrong)

  // Next Steps
  const nextSteps = [
    [
      'Have you',
      {
        link: {
          label: 'created a Shopify Partners organization',
          url: 'https://partners.shopify.com/signup',
        },
      },
      {
        char: '?',
      },
    ],
    'Have you confirmed your accounts from the emails you received?',
    [
      'Need to connect to a different App or organization? Run the command again with',
      {
        command: '--reset',
      },
    ],
  ]

  renderFatalError(new AbortError('No Organization found', undefined, nextSteps))

  renderError({
    headline: "Version couldn't be released.",
    body: 'This version needs to be submitted for review and approved by Shopify before it can be released.',
  })

  renderTable({
    rows: [
      {
        id: '1',
        name: 'John Doe',
        email: 'jon@doe.com',
      },
      {
        id: '2',
        name: 'Jane Doe',
        email: 'jane@doe.com',
      },
      {
        id: '3',
        name: 'John Smith',
        email: 'jon@smith.com',
      },
    ],
    columns: {
      id: {
        header: 'ID',
        color: 'red',
      },
      name: {
        header: 'Name',
        color: 'dim',
      },
      email: {},
    },
  })
}
