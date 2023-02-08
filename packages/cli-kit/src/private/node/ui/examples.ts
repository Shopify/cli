import {
  renderConcurrent,
  renderFatalError,
  renderInfo,
  renderSuccess,
  renderTable,
  renderText,
  renderWarning,
} from '../../../public/node/ui.js'
import {unstyled} from '../../../public/node/output.js'
import {AbortError, BugError} from '../../../public/node/error.js'
import {AbortSignal} from '../../../public/node/abort.js'
import {OutputStream} from '../ui.js'
import {JSDocTag, Project} from 'ts-morph'
import isEqual from 'lodash/isEqual.js'
import {Writable} from 'node:stream'

interface Example {
  type: 'static' | 'async' | 'prompt'
  basic: () => Promise<string>
  complete?: () => Promise<string>
}

const examples: {[key in string]: Example} = {
  renderConcurrent: {
    type: 'static',
    basic: async () => {
      let backendPromiseResolve: () => void
      let frontendPromiseResolve: () => void

      const backendPromise = new Promise<void>(function (resolve, _reject) {
        backendPromiseResolve = resolve
      })

      const frontendPromise = new Promise<void>(function (resolve, _reject) {
        frontendPromiseResolve = resolve
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

          frontendPromiseResolve()
        },
      }

      const stdout = new OutputStream({columns: 80})

      await renderConcurrent({
        processes: [backendProcess, frontendProcess],
        footer: {
          title: 'Press `p` to open your browser. Press `q` to quit.',
          subTitle: `Preview URL: https://shopify.com`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderOptions: {stdout: stdout as any},
      })

      // wait for all output to be rendered
      await frontendPromise

      return unstyled(stdout.lastFrame()!)
    },
  },
  renderInfo: {
    type: 'static',
    basic: async () => {
      return renderInfo({
        headline: 'CLI update available',
        body: ['Run', {command: 'npm run shopify upgrade'}, {char: '.'}],
      })!
    },
    complete: async () => {
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
                items: ['Item 1', 'Item 2', 'Item 3'],
              },
            },
          },
        ],
      })!
    },
  },
  renderSuccess: {
    type: 'static',
    basic: async () => {
      return renderSuccess({
        headline: 'CLI updated.',
        body: 'You are now running version 3.47.',
      })!
    },
    complete: async () => {
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
      })!
    },
  },
  renderWarning: {
    type: 'static',
    basic: async () => {
      return renderWarning({
        headline: 'You have reached your limit of checkout extensions for this app.',
        body: 'You can free up space for a new one by deleting an existing one.',
      })!
    },
    complete: async () => {
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
      })!
    },
  },
  renderFatalError: {
    type: 'static',
    basic: async () => {
      const somethingWentWrong = new BugError('Something went wrong.')

      somethingWentWrong.stack = `
  Error: Unexpected error
      at Module._compile (internal/modules/cjs/loader.js:1137:30)
      at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)
      at Module.load (internal/modules/cjs/loader.js:985:32)
      at Function.Module._load (internal/modules/cjs/loader.js:878:14)
`

      return renderFatalError(somethingWentWrong)!
    },
    complete: async () => {
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

      return renderFatalError(new AbortError('No Organization found', undefined, nextSteps))!
    },
  },
  renderSelectPrompt: {
    type: 'prompt',
    basic: async () => {
      return ''
    },
  },
  renderConfirmationPrompt: {
    type: 'prompt',
    basic: async () => {
      return ''
    },
  },
  renderAutocompletePrompt: {
    type: 'prompt',
    basic: async () => {
      return ''
    },
  },
  renderTable: {
    type: 'static',
    basic: async () => {
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
      })!
    },
  },
  renderTasks: {
    type: 'async',
    basic: async () => {
      return ''
    },
  },
  renderTextPrompt: {
    type: 'prompt',
    basic: async () => {
      return ''
    },
  },
  renderText: {
    type: 'static',
    basic: async () => {
      return renderText({text: 'Hello world!'})
    },
  },
}

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
})
const sourceFile = project.getSourceFileOrThrow('src/public/node/ui.tsx')
const renderFunctions = sourceFile.getFunctions().filter((func) => func.getNameOrThrow().startsWith('render'))
const renderFunctionNames = renderFunctions.map((func) => func.getNameOrThrow())

if (!isEqual(renderFunctionNames, Object.keys(examples))) {
  throw new Error('Every render function must have at least a basic example defined in this file')
}

const renderFunctionJsDocs = renderFunctions.map((func) => func.getJsDocs())

renderFunctionJsDocs.forEach((jsDocs) => {
  if (jsDocs.length === 0) {
    throw new Error('Every render function must have jsdocs')
  }
})

const exampleTags: {[key: string]: JSDocTag[]} = renderFunctions.reduce((acc, func) => {
  acc[func.getNameOrThrow()] = func
    .getJsDocs()
    .flatMap((jsDoc) => jsDoc.getTags())
    .filter((tag) => tag.getTagName() === 'example')

  return acc
}, {} as {[key: string]: JSDocTag[]})

for (const renderFunctionName of Object.keys(exampleTags)) {
  const existingTags = exampleTags[renderFunctionName]
  const hasCompleteExample = typeof examples[renderFunctionName]!.complete !== 'undefined'
  // eslint-disable-next-line no-await-in-loop
  const basicExample = await examples[renderFunctionName]!.basic()
  const tags = [
    {
      tagName: 'example',
      text: unstyled(`${hasCompleteExample ? 'Basic' : ''}\n${basicExample.trim()}`),
    },
  ]

  if (hasCompleteExample) {
    // eslint-disable-next-line no-await-in-loop
    const completeExample = await examples[renderFunctionName]!.complete!()
    tags.push({
      tagName: 'example',
      text: unstyled(`Complete\n${completeExample.trim()}`),
    })
  }

  const functionJsDoc = renderFunctions.find((func) => func.getNameOrThrow() === renderFunctionName)!.getJsDocs()[0]!

  functionJsDoc
    .getTags()
    .filter((tag) => tag.getTagName() === 'example')
    .forEach((tag) => tag.remove())

  functionJsDoc.addTags(tags)
}

await project.save()
