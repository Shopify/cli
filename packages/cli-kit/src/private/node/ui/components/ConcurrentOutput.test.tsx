import {ConcurrentOutput, useConcurrentOutputContext} from './ConcurrentOutput.js'
import {MouseProvider} from './Mouse.js'
import {
  render,
  sendInputAndWait,
  sendInputAndWaitForChange,
  sendInputAndWaitForContent,
  waitForContent,
} from '../../testing/ui.js'
import {AbortController, AbortSignal} from '../../../../public/node/abort.js'
import {unstyled} from '../../../../public/node/output.js'
import {Box} from 'ink'

import React from 'react'
import {describe, expect, test, vi} from 'vitest'

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

function mouseClick(column: number, row: number): [string, string] {
  return [`\u001B[<0;${column};${row}M`, `\u001B[<0;${column};${row}m`]
}

function mouseDrag(startColumn: number, startRow: number, endColumn: number, endRow: number): [string, string, string] {
  return [
    `\u001B[<0;${startColumn};${startRow}M`,
    `\u001B[<32;${endColumn};${endRow}M`,
    `\u001B[<0;${endColumn};${endRow}m`,
  ]
}

describe('ConcurrentOutput', () => {
  test('renders a stream of concurrent outputs from sub-processes', async () => {
    // Given
    const backendSync = new Synchronizer()
    const frontendSync = new Synchronizer()
    const gate = new Synchronizer()

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendSync.resolve()
        await gate.promise
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
        await gate.promise
      },
    }
    // When

    const renderInstance = render(
      <ConcurrentOutput processes={[backendProcess, frontendProcess]} abortSignal={new AbortController().signal} />,
    )

    await frontendSync.promise
    // Wait for React 19 to render the process output
    await waitForContent(renderInstance, 'third frontend message')

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

    gate.resolve()
  })

  test('strips ansi codes from the output by default', async () => {
    const output = 'foo'

    // Given
    const processSync = new Synchronizer()
    const gate = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write(`\u001b[32m${output}\u001b[39m`)
          processSync.resolve()
          await gate.promise
        },
      },
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise
    await waitForContent(renderInstance, output)

    // Then
    const logColumns = renderInstance.lastFrame()!.split('│')
    expect(logColumns.length).toBe(3)
    expect(logColumns[2]?.trim()).toEqual(output)
    gate.resolve()
  })

  test('reports every output chunk after normalizing it for display', async () => {
    const outputSync = new Synchronizer()
    const gate = new Synchronizer()
    const onOutput = vi.fn()
    const process = {
      prefix: 'backend',
      action: async (stdout: Writable, stderr: Writable) => {
        stdout.write('\u001b[32mfirst line\nsecond line\u001b[39m\n')
        useConcurrentOutputContext({outputPrefix: 'app-extension'}, () => stderr.write('third line'))
        outputSync.resolve()
        await gate.promise
      },
    }

    const renderInstance = render(
      <ConcurrentOutput processes={[process]} abortSignal={new AbortController().signal} onOutput={onOutput} />,
    )
    await outputSync.promise
    await waitForContent(renderInstance, 'third line')

    expect(onOutput).toHaveBeenNthCalledWith(1, {
      lines: ['first line', 'second line'],
      prefix: 'backend',
      timestamp: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
    })
    expect(onOutput).toHaveBeenNthCalledWith(2, {
      lines: ['third line'],
      prefix: 'app-extension',
      timestamp: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
    })

    gate.resolve()
  })

  test('does not strip ansi codes from the output when stripAnsi is false', async () => {
    const output = '\u001b[32mfoo\u001b[39m'

    // Given
    const processSync = new Synchronizer()
    const gate = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          useConcurrentOutputContext({stripAnsi: false}, () => {
            stdout.write(output)
          })
          processSync.resolve()
          await gate.promise
        },
      },
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise
    await waitForContent(renderInstance, 'foo')

    // Then
    const logColumns = renderInstance.lastFrame()!.split('│')
    expect(logColumns.length).toBe(3)
    expect(logColumns[2]?.trim()).toEqual(output)
    gate.resolve()
  })

  test('renders custom prefixes on log lines', async () => {
    // Given
    const processSync = new Synchronizer()
    const gate = new Synchronizer()
    const extensionName = 'my-extension'
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          useConcurrentOutputContext({outputPrefix: extensionName}, () => {
            stdout.write('foo bar')
          })
          processSync.resolve()
          await gate.promise
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
    await waitForContent(renderInstance, 'foo bar')

    // Then
    const logColumns = unstyled(renderInstance.lastFrame()!).split('│')
    expect(logColumns.length).toBe(3)
    expect(logColumns[1]?.trim()).toEqual(extensionName)
    gate.resolve()
  })

  test('filters matching history and future output without restarting processes', async () => {
    const outputSync = new Synchronizer()
    const gate = new Synchronizer()
    const abortSignal = new AbortController().signal
    const observedPrefixes: string[] = []
    let writeBackend = (_message: string) => {}
    let writeFrontend = (_message: string) => {}
    const backendAction = vi.fn(async (stdout: Writable) => {
      writeBackend = (message) => stdout.write(message)
      writeBackend('backend message')
      await gate.promise
    })
    const frontendAction = vi.fn(async (stdout: Writable) => {
      writeFrontend = (message) =>
        useConcurrentOutputContext({outputPrefix: 'custom-frontend'}, () => stdout.write(message))
      writeFrontend('frontend message')
      outputSync.resolve()
      await gate.promise
    })
    const processes = [
      {prefix: 'backend', action: backendAction},
      {prefix: 'frontend', action: frontendAction},
    ]

    const renderInstance = render(
      <ConcurrentOutput
        processes={processes}
        abortSignal={abortSignal}
        outputFilter={() => true}
        onOutputPrefix={(prefix) => observedPrefixes.push(prefix)}
      />,
    )
    await outputSync.promise
    await waitForContent(renderInstance, 'frontend message')
    writeFrontend('second frontend message')
    writeBackend('second backend message')
    await waitForContent(renderInstance, 'second backend message')

    renderInstance.rerender(
      <ConcurrentOutput
        processes={processes}
        abortSignal={abortSignal}
        outputFilter={(prefix) => prefix === 'backend'}
        onOutputPrefix={(prefix) => observedPrefixes.push(prefix)}
      />,
    )
    await waitForContent(renderInstance, 'backend message')

    writeFrontend('filtered frontend message')
    writeBackend('filtered backend message')
    await waitForContent(renderInstance, 'filtered backend message')

    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('backend message')
    expect(output).toContain('filtered backend message')
    expect(output).not.toContain('frontend message')
    expect(output).not.toContain('filtered frontend message')
    expect(observedPrefixes).toEqual([
      'backend',
      'custom-frontend',
      'custom-frontend',
      'backend',
      'custom-frontend',
      'backend',
    ])
    expect(backendAction).toHaveBeenCalledOnce()
    expect(frontendAction).toHaveBeenCalledOnce()

    gate.resolve()
  })

  test('renders output in a bounded viewport and scrolls with arrow and page keys', async () => {
    const outputSync = new Synchronizer()
    const gate = new Synchronizer()
    const process = {
      prefix: 'backend',
      action: async (stdout: Writable) => {
        stdout.write(Array.from({length: 10}, (_, index) => `message ${index + 1}`).join('\n'))
        outputSync.resolve()
        await gate.promise
      },
    }

    const renderInstance = render(
      <MouseProvider>
        <Box height={6}>
          <ConcurrentOutput
            processes={[process]}
            abortSignal={new AbortController().signal}
            showTimestamps={false}
            scrollable
          />
        </Box>
      </MouseProvider>,
    )
    await outputSync.promise
    await waitForContent(renderInstance, 'message 10')

    let output = unstyled(renderInstance.lastFrame()!)
    expect(output).not.toContain('message 1\n')
    expect(output).toContain('message 10')

    await sendInputAndWaitForChange(renderInstance, '\u001B[A')
    output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('message 6')
    expect(output).not.toContain('message 10')

    await sendInputAndWaitForChange(renderInstance, '\u001B[B')
    output = unstyled(renderInstance.lastFrame()!)
    expect(output).not.toContain('message 6')
    expect(output).toContain('message 10')

    await sendInputAndWaitForChange(renderInstance, '\u001B[5~')
    output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('message 3')
    expect(output).not.toContain('message 10')

    await sendInputAndWaitForChange(renderInstance, '\u001B[6~')
    output = unstyled(renderInstance.lastFrame()!)
    expect(output).not.toContain('message 3')
    expect(output).toContain('message 10')

    gate.resolve()
  })

  test('wraps long output and leaves timestamp and prefix columns blank on continuation rows', async () => {
    const outputSync = new Synchronizer()
    const gate = new Synchronizer()
    const process = {
      prefix: 'backend',
      action: async (stdout: Writable) => {
        useConcurrentOutputContext({stripAnsi: false}, () => {
          stdout.write(
            'A long log message that wraps onto another row and includes \u001B[32mCONTINUATION_END\u001B[39m',
          )
        })
        outputSync.resolve()
        await gate.promise
      },
    }

    const renderInstance = render(
      <MouseProvider>
        <Box height={4} width={50}>
          <ConcurrentOutput processes={[process]} abortSignal={new AbortController().signal} scrollable />
        </Box>
      </MouseProvider>,
    )
    await outputSync.promise
    await waitForContent(renderInstance, 'CONTINUATION_END')

    const output = unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))
    expect(output).toContain('CONTINUATION_END')
    expect(renderInstance.lastFrame()).toContain('\u001B[32mCONTINUATION_END\u001B[39m')
    expect(output.split('\n').find((line) => line.includes('CONTINUATION_END'))).toMatch(/^│ {9}│ {9}│ /u)

    await sendInputAndWaitForContent(renderInstance, 'A long log message', '\u001B[5~')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('A long log message')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('CONTINUATION_END')

    gate.resolve()
  })

  test('adds a mouse interaction hint to scrollable output only once', async () => {
    const outputSync = new Synchronizer()
    const gate = new Synchronizer()
    const onOutput = vi.fn()
    const hint = 'Hold Option or Shift while dragging to select text.'
    const process = {
      prefix: 'backend',
      action: async (stdout: Writable) => {
        stdout.write('backend output')
        outputSync.resolve()
        await gate.promise
      },
    }
    const renderInstance = render(
      <MouseProvider>
        <Box height={6}>
          <ConcurrentOutput
            processes={[process]}
            abortSignal={new AbortController().signal}
            scrollable
            mouseInteractionHint={{prefix: 'app-preview', message: hint}}
            onOutput={onOutput}
          />
        </Box>
      </MouseProvider>,
      {stdoutIsTTY: true},
    )
    await outputSync.promise
    await waitForContent(renderInstance, 'backend output')

    await sendInputAndWait(renderInstance, 20, ...mouseDrag(2, 2, 10, 2))
    await waitForContent(renderInstance, hint)
    await sendInputAndWait(renderInstance, 20, ...mouseClick(2, 2))

    expect(unstyled(renderInstance.lastFrame()!).match(/Hold Option or Shift/g)).toHaveLength(1)
    expect(onOutput).toHaveBeenNthCalledWith(2, {
      lines: [hint],
      prefix: 'app-preview',
      timestamp: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
    })
    expect(onOutput).toHaveBeenCalledTimes(2)

    gate.resolve()
  })

  test('renders prefix column width based on prefixColumnSize', async () => {
    // Given
    const processSync1 = new Synchronizer()
    const processSync2 = new Synchronizer()
    const gate = new Synchronizer()

    const columnSize = 5
    const processes = [
      {
        prefix: '1234567890',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('foo')
          processSync1.resolve()
          await gate.promise
        },
      },
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('bar')
          processSync2.resolve()
          await gate.promise
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
    await waitForContent(renderInstance, 'bar')

    // Then
    const logLines = unstyled(renderInstance.lastFrame()!).split('\n').filter(Boolean)
    expect(logLines.length).toBe(2)
    logLines.forEach((line) => {
      const logColumns = line.split('│')
      expect(logColumns.length).toBe(3)
      // Including spacing
      expect(logColumns[1]?.length).toBe(columnSize + 2)
    })
    gate.resolve()
  })

  test('renders prefix column width based on processes by default', async () => {
    // Given
    const processSync = new Synchronizer()
    const gate = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('foo')
          processSync.resolve()
          await gate.promise
        },
      },
      {prefix: '12', action: async () => gate.promise},
      {prefix: '123', action: async () => gate.promise},
      {prefix: '1234', action: async () => gate.promise},
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise
    await waitForContent(renderInstance, 'foo')

    // Then
    const logColumns = unstyled(renderInstance.lastFrame()!).split('│')
    expect(logColumns.length).toBe(3)
    // 4 is largest prefix, plus spacing
    expect(logColumns[1]?.length).toBe(4 + 2)
    gate.resolve()
  })

  test('does not render prefix column larger than max', async () => {
    // Given
    const processSync = new Synchronizer()
    const gate = new Synchronizer()
    const processes = [
      {
        prefix: '1',
        action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
          stdout.write('foo')
          processSync.resolve()
          await gate.promise
        },
      },
      {prefix: new Array(26).join('0'), action: async () => gate.promise},
    ]

    // When
    const renderInstance = render(<ConcurrentOutput processes={processes} abortSignal={new AbortController().signal} />)
    await processSync.promise
    await waitForContent(renderInstance, 'foo')

    // Then
    const logColumns = unstyled(renderInstance.lastFrame()!).split('│')
    expect(logColumns.length).toBe(3)
    // 25 is largest column allowed, plus spacing
    expect(logColumns[1]?.length).toBe(25 + 2)
    gate.resolve()
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

    await new Promise((resolve) => setTimeout(resolve, 10))
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

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(renderInstance.waitUntilExit().isFulfilled()).toBe(false)
  })
})
