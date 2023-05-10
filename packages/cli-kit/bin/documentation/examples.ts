/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  renderAutocompletePrompt,
  renderConcurrent,
  renderConfirmationPrompt,
  renderFatalError,
  renderInfo,
  renderSelectPrompt,
  renderSuccess,
  renderTable,
  renderTasks,
  renderText,
  renderTextPrompt,
  renderWarning,
} from '../../src/public/node/ui.js'
import {unstyled} from '../../src/public/node/output.js'
import {AbortError, BugError} from '../../src/public/node/error.js'
import {AbortSignal} from '../../src/public/node/abort.js'
import {Stdout} from '../../src/private/node/ui.js'
import {Stdin, waitFor} from '../../src/private/node/testing/ui.js'
import {Writable} from 'node:stream'

interface Example {
  type: 'static' | 'async' | 'prompt'
  basic: () => Promise<string>
  complete?: () => Promise<string>
}

const TERMINAL_WIDTH = 60

export const examples: {[key in string]: Example} = {
  renderConcurrent: {
    type: 'static',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})
      const stdin = new Stdin()

      let backendPromiseResolve: () => void

      const backendPromise = new Promise<void>(function (resolve, _reject) {
        backendPromiseResolve = resolve
      })

      const backendProcess = {
        prefix: 'backend',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('first backend message')
          stdout.write('second backend message')
          stdout.write('third backend message')

          backendPromiseResolve()
        },
      }

      const frontendProcess = {
        prefix: 'frontend',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          await backendPromise

          stdout.write('first frontend message')
          stdout.write('second frontend message')
          stdout.write('third frontend message')
        },
      }

      await renderConcurrent({
        processes: [backendProcess, frontendProcess],
        footer: {
          shortcuts: [{
            key: 'p',
            action: 'preview in your browser'
          }, {
            key: 'q',
            action: 'quit.',
          }],
          subTitle: `Preview URL: https://shopify.com`,
        },

        renderOptions: {stdout: stdout as any, stdin: stdin as any, debug: true},
      })

      await waitFor(
        () => {},
        () => Boolean((stdout.frames ?? []).some(frame => unstyled(frame).includes('third frontend message')))
      )

      return stdout.frames.find(frame => unstyled(frame).includes('third frontend message'))!.replace(/\d/g, '0')
    },
  },
  renderInfo: {
    type: 'static',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      return renderInfo({
        headline: 'CLI update available.',
        body: ['Run', {command: 'npm run shopify upgrade'}, {char: '.'}],
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
    complete: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      return renderInfo({
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
                items: [{link: {label: 'Item 1', url: 'https://www.google.com/search?q=jh56t9l34kpo35tw8s28hn7s9s2xvzla01d8cn6j7yq&rlz=1C1GCEU_enUS832US832&oq=jh56t9l34kpo35tw8s28hn7s9s2xvzla01d8cn6j7yq&aqs=chrome.0.35i39l2j0l4j46j69i60.2711j0j7&sourceid=chrome&ie=UTF-8'}}, 'Item 2', {link: {label: 'Item 3', url: 'https://shopify.com'}}],
              },
            },
          },
        ],
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
  },
  renderSuccess: {
    type: 'static',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      return renderSuccess({
        headline: 'CLI updated.',
        body: 'You are now running version 3.47.',
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
    complete: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      return renderSuccess({
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
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
  },
  renderWarning: {
    type: 'static',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      return renderWarning({
        headline: 'You have reached your limit of checkout extensions for this app.',
        body: 'You can free up space for a new one by deleting an existing one.',
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
    complete: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      return renderWarning({
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
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
  },
  renderFatalError: {
    type: 'static',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})
      const somethingWentWrong = new BugError('Something went wrong.')

      somethingWentWrong.stack = `
  Error: Unexpected error
      at Module._compile (internal/modules/cjs/loader.js:1137:30)
      at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)
      at Module.load (internal/modules/cjs/loader.js:985:32)
      at Function.Module._load (internal/modules/cjs/loader.js:878:14)
`

      return renderFatalError(somethingWentWrong, {
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
    complete: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

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

      const customSections = [
        {
          title: 'amortizable-marketplace-ext',
          body: [
            {
              list: {
                title: undefined,
                items: ['Some other error'],
              },
            },
            {
              list: {
                title: 'Validation errors',
                items: ['Missing expected key(s).'],
              },
            },
          ],
        },
        {
          title: 'amortizable-marketplace-ext-2',
          body: [
            {
              list: {
                title: undefined,
                items: ['Something was not found'],
              },
            },
          ],
        },
      ]

      return renderFatalError(new AbortError('No Organization found', undefined, nextSteps, customSections), {
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
  },
  renderSelectPrompt: {
    type: 'prompt',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})
      const stdin = new Stdin()

      renderSelectPrompt({
        message: 'Associate your project with the org Castile Ventures?',
        choices: [
          {label: 'first', value: 'first', key: 'f'},
          {label: 'second', value: 'second', key: 's'},
          {label: 'third', value: 'third'},
          {label: 'fourth', value: 'fourth'},
          {label: 'fifth', value: 'fifth', group: 'Automations', key: 'a'},
          {label: 'sixth', value: 'sixth', group: 'Automations'},
          {label: 'seventh', value: 'seventh'},
          {label: 'eighth', value: 'eighth', group: 'Merchant Admin'},
          {label: 'ninth', value: 'ninth', group: 'Merchant Admin'},
          {label: 'tenth', value: 'tenth'},
        ],
        infoTable: {add: ['new-ext'], remove: ['integrated-demand-ext', 'order-discount']},
        renderOptions: {
          stdout: stdout as any,
          stdin: stdin as any,
          debug: true
        },
      })

      await waitFor(
        () => {},
        () => Boolean(stdout.lastFrame()?.includes('Associate your project with the org Castile Ventures?')),
      )

      return stdout.lastFrame()!
    },
  },
  renderConfirmationPrompt: {
    type: 'prompt',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})
      const stdin = new Stdin()

      const themes = [
        [
          'first theme',
          {
            subdued: `(#${1})`,
          },
        ],
        [
          'second theme',
          {
            subdued: `(#${2})`,
          },
        ],
      ]

      const options = {
        message: `Delete the following themes from the store?`,
        infoTable: {'': themes},
        confirmationMessage: 'Yes, confirm changes',
        cancellationMessage: 'Cancel',
        renderOptions: {
          stdout: stdout as any,
          stdin: stdin as any,
          debug: true
        },
      }

      renderConfirmationPrompt(options)

      await waitFor(
        () => {},
        () => Boolean(stdout.lastFrame()?.includes('Delete the following themes from the store?')),
      )

      return stdout.lastFrame()!
    },
  },
  renderAutocompletePrompt: {
    type: 'prompt',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})
      const stdin = new Stdin()

      const database = [
        {label: 'first', value: 'first'},
        {label: 'second', value: 'second'},
        {label: 'third', value: 'third'},
        {label: 'fourth', value: 'fourth'},
        {label: 'fifth', value: 'fifth'},
        {label: 'sixth', value: 'sixth'},
        {label: 'seventh', value: 'seventh'},
        {label: 'eighth', value: 'eighth'},
        {label: 'ninth', value: 'ninth'},
        {label: 'tenth', value: 'tenth'},
        {label: 'eleventh', value: 'eleventh'},
        {label: 'twelfth', value: 'twelfth'},
        {label: 'thirteenth', value: 'thirteenth'},
        {label: 'fourteenth', value: 'fourteenth'},
        {label: 'fifteenth', value: 'fifteenth'},
        {label: 'sixteenth', value: 'sixteenth'},
        {label: 'seventeenth', value: 'seventeenth'},
        {label: 'eighteenth', value: 'eighteenth'},
        {label: 'nineteenth', value: 'nineteenth'},
        {label: 'twentieth', value: 'twentieth'},
        {label: 'twenty-first', value: 'twenty-first'},
        {label: 'twenty-second', value: 'twenty-second'},
        {label: 'twenty-third', value: 'twenty-third'},
        {label: 'twenty-fourth', value: 'twenty-fourth'},
        {label: 'twenty-fifth', value: 'twenty-fifth'},
        {label: 'twenty-sixth', value: 'twenty-sixth'},
        {label: 'twenty-seventh', value: 'twenty-seventh'},
        {label: 'twenty-eighth', value: 'twenty-eighth'},
        {label: 'twenty-ninth', value: 'twenty-ninth'},
        {label: 'thirtieth', value: 'thirtieth'},
        {label: 'thirty-first', value: 'thirty-first'},
        {label: 'thirty-second', value: 'thirty-second'},
        {label: 'thirty-third', value: 'thirty-third'},
        {label: 'thirty-fourth', value: 'thirty-fourth'},
        {label: 'thirty-fifth', value: 'thirty-fifth'},
        {label: 'thirty-sixth', value: 'thirty-sixth'},
        {label: 'thirty-seventh', value: 'thirty-seventh'},
        {label: 'thirty-eighth', value: 'thirty-eighth'},
        {label: 'thirty-ninth', value: 'thirty-ninth'},
        {label: 'fortieth', value: 'fortieth'},
        {label: 'forty-first', value: 'forty-first'},
        {label: 'forty-second', value: 'forty-second'},
        {label: 'forty-third', value: 'forty-third'},
        {label: 'forty-fourth', value: 'forty-fourth'},
        {label: 'forty-fifth', value: 'forty-fifth'},
        {label: 'forty-sixth', value: 'forty-sixth'},
        {label: 'forty-seventh', value: 'forty-seventh'},
        {label: 'forty-eighth', value: 'forty-eighth'},
        {label: 'forty-ninth', value: 'forty-ninth'},
        {label: 'fiftieth', value: 'fiftieth'},
      ]

      renderAutocompletePrompt({
        message: 'Select a template',
        choices: database,
        search(term: string) {
          return Promise.resolve({data: database.filter((item) => item.label.includes(term))})
        },
        renderOptions: {
          stdout: stdout as any,
          stdin: stdin as any,
          debug: true
        },
      })

      await waitFor(
        () => {},
        () => Boolean(stdout.lastFrame()?.includes('Select a template')),
      )

      return stdout.lastFrame()!
    },
  },
  renderTable: {
    type: 'static',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      return renderTable({
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
        renderOptions: {
          stdout: stdout as any,
        },
      })!
    },
  },
  renderTasks: {
    type: 'async',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})

      const tasks = [
        {
          title: 'Installing dependencies',
          task: async () => {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          },
        },
      ]

      renderTasks(tasks, {renderOptions: {stdout: stdout as any, debug: true}})

      await waitFor(
        () => {},
        () => Boolean(stdout.lastFrame()?.includes('Installing dependencies')),
      )

      return stdout.lastFrame()!
    },
  },
  renderTextPrompt: {
    type: 'prompt',
    basic: async () => {
      const stdout = new Stdout({columns: TERMINAL_WIDTH})
      const stdin = new Stdin()

      renderTextPrompt({
        message: 'App project name (can be changed later)',
        defaultValue: 'expansive commerce app',
        validate: (value) => {
          if (value.includes('shopify')) return 'Can\'t include "shopify" in the name'
        },
        renderOptions: {
          stdout: stdout as any,
          stdin: stdin as any,
          debug: true
        },
      })

      await waitFor(
        () => {},
        () => Boolean(stdout.lastFrame()?.includes('App project name (can be changed later)')),
      )

      return stdout.lastFrame()!
    },
  },
  renderText: {
    type: 'static',
    basic: async () => {
      return renderText({text: 'Hello world!'})
    },
  },
}
