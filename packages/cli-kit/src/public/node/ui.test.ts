import {
  keypress,
  renderConcurrent,
  renderFatalError,
  renderInfo,
  renderSuccess,
  renderTasks,
  renderWarning,
  renderSingleTask,
  Task,
} from './ui.js'
import {AbortSignal} from './abort.js'
import {BugError, FatalError, AbortError, FatalErrorType} from './error.js'
import {renderCommandEventAsJson, runWithCommandEvents} from './command-events.js'
import {mockAndCaptureOutput, withCapturedStandardStreams} from './testing/output.js'
import {TokenizedString} from './output.js'
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
  test.each(['text', 'json'] as const)(
    'preserves context, retries, subtasks, and skipping in %s mode',
    async (outputMode) => {
      const sink = vi.fn()
      const error = new Error('Try again')
      const skipped = vi.fn()
      const tasks: Task<{steps: string[]}>[] = [
        {
          title: 'Prepare',
          task: async (context) => {
            context.steps = ['prepare']
          },
        },
        {
          title: 'Upload',
          retry: 1,
          task: async (context, task) => {
            if (task.retryCount === 0) throw error
            expect(task.errors).toEqual([error])
            context.steps.push('upload')
            return [
              {title: 'Skipped subtask', skip: () => true, task: skipped},
              {
                title: 'Verify',
                task: async (context) => {
                  context.steps.push('verify')
                },
              },
            ]
          },
        },
        {title: 'Skipped task', skip: (context) => context.steps.includes('verify'), task: skipped},
      ]

      const context = await runWithCommandEvents({sink, outputMode}, () => renderTasks(tasks))

      expect(context).toEqual({steps: ['prepare', 'upload', 'verify']})
      expect(skipped).not.toHaveBeenCalled()
      expect(tasks[1]!.retryCount).toBe(1)
      const events = sink.mock.calls.map(([event]) => event)
      expect(events.map(({status, message}) => ({status, message}))).toEqual([
        {status: 'started', message: 'Prepare'},
        {status: 'updated', message: 'Upload'},
        {status: 'updated', message: 'Verify'},
        {status: 'completed', message: 'Verify'},
      ])
      expect(events[0].operation).toEqual(expect.any(String))
      expect(new Set(events.map(({operation}) => operation)).size).toBe(1)
      expect(events.at(-1)).toMatchObject({current: 1, total: 1})
      expect(sink.mock.calls.every(([, options]) => options.alreadyRendered)).toBe(true)
    },
  )

  test('writes JSON progress to stderr without rendering terminal UI', async () => {
    const write = vi.fn((_chunk, _encoding, callback) => callback())
    const stdout = new Writable({write})
    await withCapturedStandardStreams(async (streams) => {
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () =>
        renderTasks(
          [
            {title: '\u001b[32mUpload\u001b[39m', task: async () => {}},
            {title: new TokenizedString('Upload'), task: async () => {}},
          ],
          {renderOptions: {stdout: stdout as NodeJS.WriteStream}},
        ),
      )

      expect(write).not.toHaveBeenCalled()
      expect(streams.stdout()).toBe('')
      const events = streams
        .stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events).toHaveLength(3)
      expect(events.every((event) => event.type === 'progress' && event.message === 'Upload')).toBe(true)
      expect(events[0].operation).toBe(events[2].operation)
    })
  })

  test.each(['text', 'json'] as const)('stops after exhausting retries in %s mode', async (outputMode) => {
    const sink = vi.fn()
    const error = new Error('Upload failed')
    const task = vi.fn().mockRejectedValue(error)
    const nextTask = vi.fn()

    await expect(
      runWithCommandEvents({sink, outputMode}, () =>
        renderTasks([
          {title: 'Upload', retry: 1, task},
          {title: 'Next', task: nextTask},
        ]),
      ),
    ).rejects.toBe(error)

    expect(task).toHaveBeenCalledTimes(2)
    expect(nextTask).not.toHaveBeenCalled()
    expect(sink).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({type: 'progress', status: 'started', message: 'Upload'}),
      {alreadyRendered: true},
    )
  })

  test.each(['text', 'json'] as const)('runs tasks appended during execution in %s mode', async (outputMode) => {
    const sink = vi.fn()
    const tasks: Task<{finished: boolean}>[] = [
      {
        title: 'Wait',
        task: async () => {
          tasks.push({
            title: 'Finish',
            task: async (context) => {
              expect(sink.mock.calls.map(([event]) => event.status)).toEqual(['started', 'updated'])
              context.finished = true
            },
          })
        },
      },
    ]

    const context = await runWithCommandEvents({outputMode, sink}, () => renderTasks(tasks))

    expect(context).toEqual({finished: true})
    expect(sink.mock.calls.map(([event]) => event.status)).toEqual(['started', 'updated', 'completed'])
  })

  test('distinguishes concurrent JSON task lists with the same title', async () => {
    const sink = vi.fn()
    await runWithCommandEvents({outputMode: 'json', sink}, () =>
      Promise.all([
        renderTasks([{title: 'Upload', task: async () => {}}]),
        renderTasks([{title: 'Upload', task: async () => {}}]),
      ]),
    )
    const events = sink.mock.calls.map(([event]) => event)
    const operations = events.filter((event) => event.status === 'started').map((event) => event.operation)
    expect(new Set(operations).size).toBe(2)
    for (const operation of operations) {
      expect(events.filter((event) => event.operation === operation).map((event) => event.status)).toEqual([
        'started',
        'completed',
      ])
    }
  })

  test('returns an empty context for an empty JSON task list', async () => {
    const sink = vi.fn()
    const context = await runWithCommandEvents({outputMode: 'json', sink}, () => renderTasks([]))
    expect(context).toEqual({})
    expect(sink).not.toHaveBeenCalled()
  })

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

describe('keypress', async () => {
  test('waits for a keypress, managing stdin', async () => {
    let registeredListener: any
    const mockStdin = {
      setRawMode: vi.fn(),
      once: (event: string, callback: any) => {
        registeredListener = callback
      },
      ref: vi.fn(),
      unref: vi.fn(),
    } as any

    const promise = keypress(mockStdin, {skipTTYCheck: true})
    expect(mockStdin.ref).toBeCalled()
    expect(mockStdin.setRawMode).toHaveBeenLastCalledWith(true)
    // create a buffer representing pressing the enter key
    registeredListener(Buffer.from([13]))

    await promise
    expect(mockStdin.unref).toBeCalled()
    expect(mockStdin.setRawMode).toHaveBeenLastCalledWith(false)
  })

  test('rejects if sent ctrl+c', async () => {
    let registeredListener: any
    const mockStdin = {
      setRawMode: vi.fn(),
      once: (event: string, callback: any) => {
        registeredListener = callback
      },
      ref: vi.fn(),
      unref: vi.fn(),
    } as any

    const promise = keypress(mockStdin, {skipTTYCheck: true})

    // create a buffer representing pressing ctrl+c
    registeredListener(Buffer.from([3]))

    let rejected = false
    try {
      await promise
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (rejection: any) {
      expect(rejection.type).toEqual(FatalErrorType.AbortSilent)
      rejected = true
    }
    expect(rejected).toEqual(true)
  })
})

describe('renderSingleTask', async () => {
  test.each(['text', 'json'] as const)('emits correlated progress in %s mode', async (outputMode) => {
    const sink = vi.fn()

    await runWithCommandEvents({sink, outputMode}, () =>
      renderSingleTask({
        title: new TokenizedString('Creating store'),
        task: async (updateStatus) => {
          updateStatus(new TokenizedString('Saving session'))
          return 'store'
        },
      }),
    )

    expect(sink).toHaveBeenCalledTimes(3)
    const operation = sink.mock.calls[0]![0].operation
    expect(operation).toEqual(expect.any(String))
    expect(sink.mock.calls).toEqual([
      [
        expect.objectContaining({type: 'progress', operation, status: 'started', message: 'Creating store'}),
        {alreadyRendered: true},
      ],
      [
        expect.objectContaining({type: 'progress', operation, status: 'updated', message: 'Saving session'}),
        {alreadyRendered: true},
      ],
      [
        expect.objectContaining({
          type: 'progress',
          operation,
          status: 'completed',
          message: 'Saving session',
          current: 1,
          total: 1,
        }),
        {alreadyRendered: true},
      ],
    ])
  })

  test('distinguishes concurrent JSON tasks with the same title', async () => {
    const sink = vi.fn()

    await runWithCommandEvents({sink, outputMode: 'json'}, () =>
      Promise.all(
        [1, 2].map(() =>
          renderSingleTask({title: new TokenizedString('Uploading files'), task: async () => undefined}),
        ),
      ),
    )

    const events = sink.mock.calls.map(([event]) => event)
    const operations = events.filter((event) => event.status === 'started').map((event) => event.operation)
    expect(new Set(operations).size).toBe(2)
    for (const operation of operations) {
      expect(events.filter((event) => event.operation === operation).map((event) => event.status)).toEqual([
        'started',
        'completed',
      ])
    }
  })

  test('calls onAbort on SIGINT in JSON mode and removes the listener', async () => {
    const listeners = process.listeners('SIGINT')
    const onAbort = vi.fn()

    await runWithCommandEvents({outputMode: 'json'}, () =>
      renderSingleTask({
        title: new TokenizedString('Waiting'),
        onAbort,
        task: async () => {
          expect(process.listenerCount('SIGINT')).toBe(listeners.length + 1)
          process.emit('SIGINT')
          expect(onAbort).toHaveBeenCalledOnce()
          expect(process.listeners('SIGINT')).toEqual(listeners)
        },
      }),
    )

    expect(process.listeners('SIGINT')).toEqual(listeners)
  })

  test.each([false, true])('removes the JSON abort listener when the task settles (failure: %s)', async (fails) => {
    const listeners = process.listeners('SIGINT')
    const onAbort = vi.fn()
    const sink = vi.fn()
    const error = new Error('Task failed')

    const result = runWithCommandEvents({sink, outputMode: 'json'}, () =>
      renderSingleTask({
        title: new TokenizedString('Uploading files'),
        onAbort,
        task: async () => {
          expect(process.listenerCount('SIGINT')).toBe(listeners.length + 1)
          if (fails) throw error
          return 'done'
        },
      }),
    )

    if (fails) {
      await expect(result).rejects.toBe(error)
      expect(sink.mock.calls.map(([event]) => event.status)).toEqual(['started'])
    } else {
      await expect(result).resolves.toBe('done')
    }
    expect(onAbort).not.toHaveBeenCalled()
    expect(process.listeners('SIGINT')).toEqual(listeners)
  })

  test('preserves default SIGINT handling when a JSON task has no onAbort callback', async () => {
    const listeners = process.listeners('SIGINT')

    await runWithCommandEvents({outputMode: 'json'}, () =>
      renderSingleTask({
        title: new TokenizedString('Uploading files'),
        task: async () => {
          expect(process.listeners('SIGINT')).toEqual(listeners)
        },
      }),
    )
  })

  test('uses progress events instead of task UI for JSON output', async () => {
    const sink = vi.fn()
    const write = vi.fn((_chunk, _encoding, callback: () => void) => callback())
    const stdout = new Writable({write})

    const result = await runWithCommandEvents({sink, outputMode: 'json'}, () =>
      renderSingleTask({
        title: new TokenizedString('Creating store'),
        task: async () => 'store',
        renderOptions: {stdout: stdout as unknown as NodeJS.WriteStream},
      }),
    )

    expect(result).toBe('store')
    expect(write).not.toHaveBeenCalled()
    expect(sink).toHaveBeenCalledTimes(2)
  })

  test('returns promise result when task resolves successfully', async () => {
    // Given
    const expectedResult = {id: 123, name: 'test-result'}
    const task = () => Promise.resolve(expectedResult)
    const title = new TokenizedString('Processing data')

    // When
    const result = await renderSingleTask({title, task})

    // Then
    expect(result).toEqual(expectedResult)
  })

  test('returns function result when function resolves successfully', async () => {
    // Given
    const expectedResult = {id: 123, name: 'test-result'}
    const task = () => Promise.resolve(expectedResult)
    const title = new TokenizedString('Processing data')

    // When
    const result = await renderSingleTask({title, task})

    // Then
    expect(result).toEqual(expectedResult)
  })

  test('returns undefined when task resolves with undefined', async () => {
    // Given
    const task = () => Promise.resolve(undefined)
    const title = new TokenizedString('Void task')

    // When
    const result = await renderSingleTask({title, task})

    // Then
    expect(result).toBeUndefined()
  })

  test('throws error when task promise rejects', async () => {
    // Given
    const expectedError = new Error('Task failed with error')
    const task = () => Promise.reject(expectedError)
    const title = new TokenizedString('Failing task')

    // When & Then
    await expect(renderSingleTask({title, task})).rejects.toThrow('Task failed with error')
  })

  test('handles slow promise rejection', async () => {
    // Given
    const expectedError = new Error('Delayed failure')
    const task = () =>
      new Promise((resolve, reject) => {
        setTimeout(() => reject(expectedError), 100)
      })
    const title = new TokenizedString('Slow failing task')

    // When & Then
    await expect(renderSingleTask({title, task})).rejects.toThrow('Delayed failure')
  })

  test('handles sequential single tasks', async () => {
    // Given
    const task1 = () => new Promise((resolve) => setTimeout(() => resolve('result1'), 50))
    const task2 = () => new Promise((resolve) => setTimeout(() => resolve('result2'), 100))
    const task3 = () => new Promise((resolve) => setTimeout(() => resolve('result3'), 25))

    // When — ink only supports one render instance per stdout at a time,
    // so sequential execution is the correct pattern
    const result1 = await renderSingleTask({title: new TokenizedString('Task 1'), task: task1})
    const result2 = await renderSingleTask({title: new TokenizedString('Task 2'), task: task2})
    const result3 = await renderSingleTask({title: new TokenizedString('Task 3'), task: task3})

    // Then
    expect(result1).toBe('result1')
    expect(result2).toBe('result2')
    expect(result3).toBe('result3')
  })
})

describe('sequential renders', () => {
  test('consecutive renders do not interleave or leak teardown output', async () => {
    const output = mockAndCaptureOutput()

    await renderTasks([
      {
        title: 'First batch',
        task: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
        },
      },
    ])

    await renderSingleTask({
      title: new TokenizedString('Second batch'),
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 'done'
      },
    })

    // The key assertion: no interleaving. The second render's output should
    // not contain fragments from the first render's teardown.
    const frames = output.output()
    expect(frames).not.toContain('First batch')
  })
})
