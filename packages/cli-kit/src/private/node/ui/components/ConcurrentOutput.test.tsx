import {ConcurrentOutput, useConcurrentOutputContext} from './ConcurrentOutput.js'
import {render} from '../../testing/ui.js'
import {AbortController, AbortSignal} from '../../../../public/node/abort.js'
import {unstyled} from '../../../../public/node/output.js'
import React from 'react'
import {describe, expect, test} from 'vitest'
import {Writable} from 'stream'

/**
 * ConcurrentOutput tests are unreliable unless we await a promise that resolves after the process has written to stdout.
 */
class Synchronizer {
  resolve: () => void
  promise: Promise<void>

  constructor() {
    this.resolve = () => {}
    this.promise = new Promise<void>((resolve, _reject) => {
      this.resolve = resolve
    })
  }
}

describe('ConcurrentOutput', () => {
  test('renders a stream of concurrent outputs from sub-processes', async () => {
    // Given
    const backendSync = new Synchronizer()
    const frontendSync = new Synchronizer()

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendSync.resolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        await backendSync.promise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')

        frontendSync.resolve()
      },
    }
    // When

    const renderInstance = render(
      <ConcurrentOutput processes={[backendProcess, frontendProcess]} abortSignal={new AbortController().signal} />,
    )

    await frontendSync.promise

    // Then
    expect(unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "00:00:00 │  backend │ first backend message
      00:00:00 │  backend │ second backend message
      00:00:00 │  backend │ third backend message
      00:00:00 │ frontend │ first frontend message
      00:00:00 │ frontend │ second frontend message
      00:00:00 │ frontend │ third frontend message
      "
    `)
  })

  test('strips ansi codes from the output by default', async () => {
    const output = 'foo'

    // Given
    const processSync = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write(`\u001b[32m${output}\u001b[39m`)
          processSync.resolve()
        },
      },
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise

    // Then
    const logColumns = renderInstance.lastFrame()!.split('│')
    expect(logColumns.length).toBe(3)
    expect(logColumns[2]?.trim()).toEqual(output)
  })

  test('does not strip ansi codes from the output when stripAnsi is false', async () => {
    const output = '\u001b[32mfoo\u001b[39m'

    // Given
    const processSync = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          useConcurrentOutputContext({stripAnsi: false}, () => {
            stdout.write(output)
          })
          processSync.resolve()
        },
      },
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise

    // Then
    const logColumns = renderInstance.lastFrame()!.split('│')
    expect(logColumns.length).toBe(3)
    expect(logColumns[2]?.trim()).toEqual(output)
  })

  test('renders custom prefixes on log lines', async () => {
    // Given
    const processSync = new Synchronizer()
    const extensionName = 'my-extension'
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          useConcurrentOutputContext({outputPrefix: extensionName}, () => {
            stdout.write('foo bar')
          })
          processSync.resolve()
        },
      },
    ]

    // When
    const renderInstance = render(
      <ConcurrentOutput
        processes={processes}
        // Ensure it's not truncated
        prefixColumnSize={extensionName.length}
        abortSignal={new AbortController().signal}
      />,
    )

    await processSync.promise

    // Then
    const logColumns = unstyled(renderInstance.lastFrame()!).split('│')
    expect(logColumns.length).toBe(3)
    expect(logColumns[1]?.trim()).toEqual(extensionName)
  })

  test('renders prefix column width based on prefixColumnSize', async () => {
    // Given
    const processSync1 = new Synchronizer()
    const processSync2 = new Synchronizer()

    const columnSize = 5
    const processes = [
      {
        prefix: '1234567890',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('foo')
          processSync1.resolve()
        },
      },
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('bar')
          processSync2.resolve()
        },
      },
    ]

    // When
    const renderInstance = render(
      <ConcurrentOutput
        processes={processes}
        prefixColumnSize={columnSize}
        abortSignal={new AbortController().signal}
      />,
    )
    await Promise.all([processSync1.promise, processSync2.promise])

    // Then
    const logLines = unstyled(renderInstance.lastFrame()!).split('\n').filter(Boolean)
    expect(logLines.length).toBe(2)
    logLines.forEach((line) => {
      const logColumns = line.split('│')
      expect(logColumns.length).toBe(3)
      // Including spacing
      expect(logColumns[1]?.length).toBe(columnSize + 2)
    })
  })

  test('renders prefix column width based on processes by default', async () => {
    // Given
    const processSync = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('foo')
          processSync.resolve()
        },
      },
      {prefix: '12', action: async () => {}},
      {prefix: '123', action: async () => {}},
      {prefix: '1234', action: async () => {}},
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise

    // Then
    const logColumns = unstyled(renderInstance.lastFrame()!).split('│')
    expect(logColumns.length).toBe(3)
    // 4 is largest prefix, plus spacing
    expect(logColumns[1]?.length).toBe(4 + 2)
  })

  test('does not render prefix column larger than max', async () => {
    // Given
    const processSync = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('foo')
          processSync.resolve()
        },
      },
      {prefix: new Array(26).join('0'), action: async () => {}},
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise

    // Then
    const logColumns = unstyled(renderInstance.lastFrame()!).split('│')
    expect(logColumns.length).toBe(3)
    // 25 is largest column allowed, plus spacing
    expect(logColumns[1]?.length).toBe(25 + 2)
  })

  test('rejects with the error thrown inside one of the processes', async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        throw new Error('something went wrong')
      },
    }

    // When

    const renderInstance = render(
      <ConcurrentOutput processes={[backendProcess]} abortSignal={new AbortController().signal} />,
    )

    const renderPromise = renderInstance.waitUntilExit()

    await expect(renderPromise).rejects.toThrowError('something went wrong')
    expect(renderPromise.isRejected()).toBe(true)
  })

  test("doesn't reject when an error is thrown inside one of the processes and keepRunningAfterProcessesResolve is true", async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        throw new Error('something went wrong')
      },
    }

    // When

    const renderInstance = render(
      <ConcurrentOutput
        processes={[backendProcess]}
        abortSignal={new AbortController().signal}
        keepRunningAfterProcessesResolve
      />,
    )

    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(renderInstance.waitUntilExit().isRejected()).toBe(false)
  })

  test('render promise resolves when all processes resolve by default', async () => {
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    // When
    const renderInstance = render(
      <ConcurrentOutput processes={[backendProcess]} abortSignal={new AbortController().signal} />,
    )

    const renderPromise = renderInstance.waitUntilExit()

    await renderPromise
    expect(renderPromise.isFulfilled()).toBe(true)
  })

  test("render promise doesn't resolve when all processes resolve and keepRunningAfterProcessesResolve is true", async () => {
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    // When
    const renderInstance = render(
      <ConcurrentOutput
        keepRunningAfterProcessesResolve
        processes={[backendProcess]}
        abortSignal={new AbortController().signal}
      />,
    )

    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(renderInstance.waitUntilExit().isFulfilled()).toBe(false)
  })
})
