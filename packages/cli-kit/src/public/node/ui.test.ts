import {renderError, renderFatalError, renderInfo, renderSuccess, renderWarning} from './ui.js'
import {Abort, Bug} from '../../error.js'
import * as outputMocker from '../../testing/output.js'
import {run} from '../../testing/ui.js'
import {afterEach, describe, expect, test} from 'vitest'
import stripAnsi from 'strip-ansi'

afterEach(() => {
  outputMocker.mockAndCaptureOutput().clear()
})

describe('renderInfo', async () => {
  test('renders info inside a banner', async () => {
    // Given
    const mockOutput = outputMocker.mockAndCaptureOutput()

    // When
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
    })

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Title                                                                       │
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
      │    • Press 'return' to open the really amazing and clean dev docs:           │
      │      https://shopify.dev                                                     │
      │                                                                              │
      │  Link: https://shopify.com                                                   │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯"
    `)
  })
})

describe('renderSuccess', async () => {
  test('renders a success message inside a banner', async () => {
    // Given
    const mockOutput = outputMocker.mockAndCaptureOutput()

    // When
    renderSuccess({
      headline: 'Title',
    })

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Title                                                                       │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯"
    `)
  })
})

describe('renderWarning', async () => {
  test('renders a warning inside a banner with good wrapping', async () => {
    // Given
    const mockOutput = outputMocker.mockAndCaptureOutput()

    // When
    renderWarning({
      headline: 'Title',
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
      │  Title                                                                       │
      │                                                                              │
      │  Next steps                                                                  │
      │    1. First                                                                  │
      │    2. Second                                                                 │
      │                                                                              │
      │  Reference                                                                   │
      │    • Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do         │
      │      eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad  │
      │       minim veniam, quis nostrud exercitation ullamco laboris nisi ut        │
      │      aliquip ex ea commodo consequat.                                        │
      │    • Duis aute irure dolor in reprehenderit in voluptate velit esse cillum   │
      │      dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non  │
      │       proident, sunt in culpa qui officia deserunt mollit anim id est        │
      │      laborum.                                                                │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯"
    `)
  })
})

describe('renderError', async () => {
  test('renders an error inside a banner', async () => {
    // Given
    const mockOutput = outputMocker.mockAndCaptureOutput()

    // When
    renderError({
      headline: 'Something went wrong.',
      tryMessage: 'Check your internet connection.',
    })

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Something went wrong.                                                       │
      │                                                                              │
      │  Check your internet connection.                                             │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯"
    `)
  })
})

describe('renderFatalError', async () => {
  test('renders a fatal error inside a banner', async () => {
    // Given
    const mockOutput = outputMocker.mockAndCaptureOutput()

    // When
    renderFatalError(
      new Abort("Couldn't connect to the Shopify Partner Dashboard.", 'Check your internet connection and try again.'),
    )

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Couldn't connect to the Shopify Partner Dashboard.                          │
      │                                                                              │
      │  Check your internet connection and try again.                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯"
    `)
  })

  test('renders a fatal error inside a banner with a stack trace', async () => {
    // Given
    const mockOutput = outputMocker.mockAndCaptureOutput()

    // When
    const error = new Bug('Unexpected error')
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
      │  at _compile (internal/modules/cjs/loader.js:1137)                           │
      │  at js (internal/modules/cjs/loader.js:1157)                                 │
      │  at load (internal/modules/cjs/loader.js:985)                                │
      │  at _load (internal/modules/cjs/loader.js:878)                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯"
    `)
  })
})

describe('renderConcurrent', async () => {
  test('renders a stream of concurrent outputs from sub-processes', async () => {
    // When
    const {stdout} = await run('render-concurrent')
    const lastFrame = stripAnsi(stdout).replace(/\d/g, '0')

    // Then
    expect(lastFrame).toMatchInlineSnapshot(`
      "0000-00-00 00:00:00 | backend  | first backend message
      0000-00-00 00:00:00 | backend  | second backend message
      0000-00-00 00:00:00 | backend  | third backend message
      0000-00-00 00:00:00 | frontend | first frontend message
      0000-00-00 00:00:00 | frontend | second frontend message
      0000-00-00 00:00:00 | frontend | third frontend message
      "
    `)
  })
})
