import {error} from '@shopify/cli-kit'
import {
  renderConcurrent,
  renderFatalError,
  renderInfo,
  renderPrompt,
  renderSuccess,
  renderWarning,
} from '@shopify/cli-kit/node/ui'
import {Signal} from '@shopify/cli-kit/src/abort'
import {Writable} from 'node:stream'

export async function kitchenSink() {
  renderInfo({
    headline: 'CLI update available',
    body: ['Run', {command: 'npm run shopify upgrade'}, {char: '.'}],
  })

  renderInfo({
    headline: [
      "To connect this project to your shopify store's inventory:",
      {filePath: '/my-store/hydrogen.config.js'},
      'with your store ID and Storefront API key.',
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
  const somethingWentWrong = new error.Bug('Something went wrong.')

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

  renderFatalError(new error.Abort('No Organization found', undefined, nextSteps))

  // renderConcurrent at the end
  let backendPromiseResolve: () => void

  const backendPromise = new Promise<void>(function (resolve, _reject) {
    backendPromiseResolve = resolve
  })

  const backendProcess = {
    prefix: 'backend',
    action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
      stdout.write('first backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('second backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('third backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))

      backendPromiseResolve()
    },
  }

  const frontendProcess = {
    prefix: 'frontend',
    action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
      await backendPromise

      stdout.write('first frontend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('second frontend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('third frontend message')
    },
  }

  await renderPrompt({
    message: 'Associate your project with the org Castile Ventures?',
    choices: [
      {label: 'first', value: 'first', key: 'f'},
      {label: 'second', value: 'second', key: 's'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
      {label: 'fifth', value: 'fifth'},
      {label: 'sixth', value: 'sixth'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth', value: 'eighth'},
      {label: 'ninth', value: 'ninth'},
    ],
    onChoose(item) {
      // eslint-disable-next-line no-console
      console.log(`selected ${item.label}!`)
    },
  })

  await renderConcurrent({processes: [backendProcess, frontendProcess]})
}
