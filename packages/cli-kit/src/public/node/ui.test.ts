import {renderConcurrent, renderFatalError, renderInfo, renderSuccess, renderTasks, renderWarning} from './ui.js'
import {AbortSignal} from './abort.js'
import {BugError, FatalError, AbortError} from './error.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import supportsHyperlinks from 'supports-hyperlinks'
import {Writable} from 'stream'

vi.mock('supports-hyperlinks')

beforeEach(() => {
  vi.mocked(supportsHyperlinks).stdout = false
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('renderInfo', async () => {
  test('renders info inside a banner', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    renderInfo({
      headline: 'Title.',
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
          // testing link wrapping behavior
          "Press 'return' to open the really amazing and clean",
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
      customSections: [
        {
          title: 'Custom section',
          body: {
            list: {
              items: ['Item 1', 'Item 2', 'Item 3'],
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

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Title.                                                                      │
      │                                                                              │
      │  Body                                                                        │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Run \`cd santorini-goods\`                                                │
      │    • To preview your project, run \`npm app dev\`                              │
      │    • To add extensions, run \`npm generate extension\`                         │
      │                                                                              │
      │  Reference                                                                   │
      │    • Run \`npm shopify help\`                                                  │
      │    • Press 'return' to open the really amazing and clean dev docs [1]        │
      │                                                                              │
      │  Link [2]                                                                    │
      │                                                                              │
      │  Custom section                                                              │
      │    • Item 1                                                                  │
      │    • Item 2                                                                  │
      │    • Item 3                                                                  │
      │                                                                              │
      │  Custom section 2                                                            │
      │    • Item 1                                                                  │
      │    • Item 2                                                                  │
      │    • Item 3                                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev
      [2] https://shopify.com
      "
    `)
  })
})

describe('renderSuccess', async () => {
  test('renders a success message inside a banner', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    renderSuccess({
      headline: 'Title.',
    })

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Title.                                                                      │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })
})

describe('renderWarning', async () => {
  test('renders a warning inside a banner with good wrapping', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    renderWarning({
      headline: 'Title.',
      reference: [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      ],
      nextSteps: ['First', 'Second'],
      orderedNextSteps: true,
    })

    // Then
    expect(mockOutput.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Title.                                                                      │
      │                                                                              │
      │  Next steps                                                                  │
      │    1. First                                                                  │
      │    2. Second                                                                 │
      │                                                                              │
      │  Reference                                                                   │
      │    • Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod │
      │       tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim   │
      │      veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea │
      │       commodo consequat.                                                     │
      │    • Duis aute irure dolor in reprehenderit in voluptate velit esse cillum   │
      │      dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non  │
      │      proident, sunt in culpa qui officia deserunt mollit anim id est         │
      │      laborum.                                                                │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })
})

describe('renderFatalError', async () => {
  test('renders a fatal error inside a banner', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    renderFatalError(
      new AbortError(
        "Couldn't connect to the Shopify Partner Dashboard.",
        'Check your internet connection and try again.',
      ),
    )

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Couldn't connect to the Shopify Partner Dashboard.                          │
      │                                                                              │
      │  Check your internet connection and try again.                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders a fatal error inside a banner with a stack trace', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    const error = new BugError('Unexpected error')
    error.stack = `
      Error: Unexpected error
          at Module._compile (internal/modules/cjs/loader.js:1137:30)
          at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)
          at Module.load (internal/modules/cjs/loader.js:985:32)
          at Function.Module._load (internal/modules/cjs/loader.js:878:14)
    `
    renderFatalError(error)

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Unexpected error                                                            │
      │                                                                              │
      │  To investigate the issue, examine this stack trace:                         │
      │    at _compile (internal/modules/cjs/loader.js:1137)                         │
      │    at js (internal/modules/cjs/loader.js:1157)                               │
      │    at load (internal/modules/cjs/loader.js:985)                              │
      │    at _load (internal/modules/cjs/loader.js:878)                             │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders a fatal error inside a banner with some next steps', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

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

    // When
    const error = new AbortError('No Organization found', undefined, nextSteps)
    renderFatalError(error)

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  No Organization found                                                       │
      │                                                                              │
      │  Next steps                                                                  │
      │    • Have you created a Shopify Partners organization [1]?                   │
      │    • Have you confirmed your accounts from the emails you received?          │
      │    • Need to connect to a different App or organization? Run the command     │
      │      again with \`--reset\`                                                    │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://partners.shopify.com/signup
      "
    `)
  })
})

describe('renderConcurrent', async () => {
  test('renders an error message correctly when a process throws an error', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    const throwingProcess = {
      prefix: 'backend',
      action: async (_stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        throw new Error('example error')
      },
    }

    try {
      await renderConcurrent({processes: [throwingProcess]})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      renderFatalError(error as FatalError)
    }

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  example error                                                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })
})

describe('renderTasks', async () => {
  test('renders an error message correctly when the task throws an error', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    const throwingTask = {
      title: 'throwing task',
      task: async () => {
        throw new Error('example error')
      },
    }

    try {
      await renderTasks([throwingTask])
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error: any) {
      renderWarning({
        headline: error.message,
      })
    }

    // Then
    expect(mockOutput.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  example error                                                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })
})
