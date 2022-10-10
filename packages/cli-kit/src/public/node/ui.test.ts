import {renderConcurrent, renderError, renderFatalError, renderInfo, renderSuccess, renderWarning} from './ui.js'
import {Abort} from '../../error.js'
import * as outputMocker from '../../testing/output.js'
import {Signal} from '../../abort.js'
import {createStdout} from '../../testing/ui.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {Writable} from 'node:stream'

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
      "╭ info ────────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │ Title                                                                        │
      │                                                                              │
      │ Body                                                                         │
      │                                                                              │
      │ Next steps                                                                   │
      │   • Run cd santorini-goods                                                   │
      │   • To preview your project, run npm app dev                                 │
      │   • To add extensions, run npm generate extension                            │
      │                                                                              │
      │ Reference                                                                    │
      │   • Run npm shopify help                                                     │
      │   • Press 'return' to open the really amazing and clean dev docs:            │
      │     https://shopify.dev                                                      │
      │                                                                              │
      │ Link: https://shopify.com                                                    │
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
      body: 'Body',
    })

    // Then
    expect(mockOutput.success()).toMatchInlineSnapshot('""')
  })
})

describe('renderWarning', async () => {
  test('renders a warning inside a banner with good wrapping', async () => {
    // Given
    const mockOutput = outputMocker.mockAndCaptureOutput()

    // When
    renderWarning({
      body: 'Body',
      reference: [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      ],
      nextSteps: ['First', 'Second'],
      orderedNextSteps: true,
    })

    // Then
    expect(mockOutput.warn()).toMatchInlineSnapshot(`
      "╭ warning ─────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │ Body                                                                         │
      │                                                                              │
      │ Next steps                                                                   │
      │   1. First                                                                   │
      │   2. Second                                                                  │
      │                                                                              │
      │ Reference                                                                    │
      │   • Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  │
      │     tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim     │
      │     veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea  │
      │     commodo consequat.                                                       │
      │   • Duis aute irure dolor in reprehenderit in voluptate velit esse cillum    │
      │     dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non   │
      │     proident, sunt in culpa qui officia deserunt mollit anim id est laborum. │
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
      tryMessages: ['Check your internet connection.', 'Try again.'],
    })

    // Then
    expect(mockOutput.error()).toMatchInlineSnapshot(`
      "╭ error ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │ Something went wrong.                                                        │
      │                                                                              │
      │ What to try                                                                  │
      │   • Check your internet connection.                                          │
      │   • Try again.                                                               │
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
      "╭ error ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │ Couldn't connect to the Shopify Partner Dashboard.                           │
      │                                                                              │
      │ What to try                                                                  │
      │   • Check your internet connection and try again.                            │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯"
    `)
  })
})

describe('renderConcurrent', async () => {
  test('renders a stream of concurrent outputs from sub-processes', async () => {
    // Given
    vi.useFakeTimers().setSystemTime(new Date(2022, 10, 10, 13, 15, 23))
    let backendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: Signal) => {
        await backendPromise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')
      },
    }

    const stdout = createStdout()

    // When
    await renderConcurrent({processes: [backendProcess, frontendProcess], stdout})

    // Then
    expect(stdout.get()).toMatchInlineSnapshot(`
      "2022-11-10 13:15:23 | backend  | first backend message
      2022-11-10 13:15:23 | backend  | second backend message
      2022-11-10 13:15:23 | backend  | third backend message

      2022-11-10 13:15:23 | frontend | first frontend message
      2022-11-10 13:15:23 | frontend | second frontend message
      2022-11-10 13:15:23 | frontend | third frontend message
      "
    `)
  })
})
