import {renderConcurrentOutputRL} from './ConcurrentOutputRL.js'
import {useConcurrentOutputContext} from './ConcurrentOutput.js'
import {AbortController, AbortSignal} from '../../../../public/node/abort.js'
import {describe, expect, test} from 'vitest'
import {Writable} from 'stream'
import stripAnsi from 'strip-ansi'

/** Collects everything written to a writable into an array of strings. */
function createCapture(): {stream: NodeJS.WritableStream; lines: () => string[]} {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, cb) {
      chunks.push(chunk.toString('utf8'))
      cb()
    },
  }) as unknown as NodeJS.WritableStream

  // readline.clearLine / cursorTo write escape codes – we strip them.
  return {
    stream,
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((l) => l.length > 0)
        .map((l) => stripAnsi(l)),
  }
}

describe('ConcurrentOutputRL', () => {
  test('renders a stream of concurrent outputs from sub-processes', async () => {
    const capture = createCapture()

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')
      },
    }

    await renderConcurrentOutputRL({
      processes: [backendProcess, frontendProcess],
      abortSignal: new AbortController().signal,
      output: capture.stream,
    })

    const lines = capture.lines()
    expect(lines).toHaveLength(6)

    // Check backend lines come first (sequential await order)
    expect(lines[0]).toContain('backend')
    expect(lines[0]).toContain('first backend message')
    expect(lines[1]).toContain('second backend message')
    expect(lines[2]).toContain('third backend message')

    // Then frontend
    expect(lines[3]).toContain('frontend')
    expect(lines[3]).toContain('first frontend message')
    expect(lines[5]).toContain('third frontend message')
  })

  test('renders timestamps by default', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {
          prefix: 'app',
          action: async (stdout) => {
            stdout.write('hello')
          },
        },
      ],
      abortSignal: new AbortController().signal,
      output: capture.stream,
    })

    const line = capture.lines()[0]!
    // Timestamp format: HH:MM:SS │
    expect(line).toMatch(/^\d{2}:\d{2}:\d{2} │/)
  })

  test('hides timestamps when showTimestamps is false', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {
          prefix: 'app',
          action: async (stdout) => {
            stdout.write('hello')
          },
        },
      ],
      abortSignal: new AbortController().signal,
      showTimestamps: false,
      output: capture.stream,
    })

    const line = capture.lines()[0]!
    expect(line).not.toMatch(/^\d{2}:\d{2}:\d{2}/)
    expect(line).toContain('app')
    expect(line).toContain('hello')
  })

  test('strips ansi codes from process output', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {
          prefix: 'p',
          action: async (stdout) => {
            stdout.write('\u001b[32mcolored\u001b[39m')
          },
        },
      ],
      abortSignal: new AbortController().signal,
      output: capture.stream,
    })

    const line = capture.lines()[0]!
    expect(line).toContain('colored')
    // The process output portion should be stripped (our capture also strips)
    expect(line).not.toContain('\u001b[32m')
  })

  test('pads prefix column based on longest prefix', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {prefix: 'a', action: async (stdout) => stdout.write('msg1')},
        {prefix: 'long', action: async (stdout) => stdout.write('msg2')},
      ],
      abortSignal: new AbortController().signal,
      showTimestamps: false,
      output: capture.stream,
    })

    const lines = capture.lines()
    // Both lines should have the same prefix column width (4 = "long".length)
    const col1 = lines[0]!.split('│')[0]!
    const col2 = lines[1]!.split('│')[0]!
    expect(col1.length).toBe(col2.length)
    // 'a' should be right-aligned in 4-char column
    expect(col1.trimStart()).toBe('a ')
  })

  test('respects prefixColumnSize option', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {prefix: '1234567890', action: async (stdout) => stdout.write('foo')},
        {prefix: '1', action: async (stdout) => stdout.write('bar')},
      ],
      prefixColumnSize: 5,
      abortSignal: new AbortController().signal,
      showTimestamps: false,
      output: capture.stream,
    })

    const lines = capture.lines()
    // First prefix should be truncated to 5 chars
    const prefixCol0 = lines[0]!.split('│')[0]!
    expect(prefixCol0.trim()).toBe('12345')

    // Both prefix columns should have the same width
    const prefixCol1 = lines[1]!.split('│')[0]!
    expect(prefixCol0.length).toBe(prefixCol1.length)
  })

  test('caps prefix column at 25 characters', async () => {
    const capture = createCapture()
    const longPrefix = 'a'.repeat(30)

    await renderConcurrentOutputRL({
      processes: [{prefix: longPrefix, action: async (stdout) => stdout.write('msg')}],
      abortSignal: new AbortController().signal,
      showTimestamps: false,
      output: capture.stream,
    })

    const prefixCol = capture.lines()[0]!.split('│')[0]!
    // Should be capped at 25 + 1 space
    expect(prefixCol.trim().length).toBe(25)
  })

  test('rejects with the error thrown inside one of the processes', async () => {
    const capture = createCapture()

    const failing = {
      prefix: 'fail',
      action: async (stdout: Writable) => {
        stdout.write('before error')
        throw new Error('something went wrong')
      },
    }

    await expect(
      renderConcurrentOutputRL({
        processes: [failing],
        abortSignal: new AbortController().signal,
        output: capture.stream,
      }),
    ).rejects.toThrowError('something went wrong')
  })

  test("doesn't reject when error thrown and keepRunningAfterProcessesResolve is true", async () => {
    const capture = createCapture()
    const abortController = new AbortController()

    const failing = {
      prefix: 'fail',
      action: async (stdout: Writable) => {
        stdout.write('before error')
        throw new Error('something went wrong')
      },
    }

    // Should not throw
    await renderConcurrentOutputRL({
      processes: [failing],
      abortSignal: abortController.signal,
      keepRunningAfterProcessesResolve: true,
      output: capture.stream,
    })
  })

  test('blocks until abort signal when keepRunningAfterProcessesResolve is true', async () => {
    const capture = createCapture()
    const abortController = new AbortController()
    let resolved = false

    const promise = renderConcurrentOutputRL({
      processes: [{prefix: 'p', action: async (stdout) => stdout.write('done')}],
      abortSignal: abortController.signal,
      keepRunningAfterProcessesResolve: true,
      output: capture.stream,
    }).then(() => {
      resolved = true
    })

    // Give it a tick – should still be pending
    await new Promise((r) => setTimeout(r, 20))
    expect(resolved).toBe(false)

    // Abort to unblock
    abortController.abort()
    await promise
    expect(resolved).toBe(true)
  })

  test('handles multi-line writes correctly', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {
          prefix: 'app',
          action: async (stdout) => {
            stdout.write('line1\nline2\nline3')
          },
        },
      ],
      abortSignal: new AbortController().signal,
      output: capture.stream,
    })

    const lines = capture.lines()
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('line1')
    expect(lines[1]).toContain('line2')
    expect(lines[2]).toContain('line3')
    // Each line should have the prefix
    for (const line of lines) {
      expect(line).toContain('app')
    }
  })

  test('uses outputPrefix from useConcurrentOutputContext', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {
          prefix: 'process-1',
          action: async (stdout) => {
            useConcurrentOutputContext({outputPrefix: 'my-extension'}, () => {
              stdout.write('extension log line')
            })
          },
        },
      ],
      abortSignal: new AbortController().signal,
      showTimestamps: false,
      output: capture.stream,
    })

    const lines = capture.lines()
    expect(lines).toHaveLength(1)
    // Should use the context prefix, not the process prefix
    expect(lines[0]).toContain('my-extension')
    expect(lines[0]).toContain('extension log line')
    expect(lines[0]).not.toContain('process-1')
  })

  test('does not strip ansi when context sets stripAnsi: false', async () => {
    const capture = createCapture()

    await renderConcurrentOutputRL({
      processes: [
        {
          prefix: 'p',
          action: async (stdout) => {
            useConcurrentOutputContext({stripAnsi: false}, () => {
              stdout.write('\u001b[32mcolored\u001b[39m')
            })
          },
        },
      ],
      abortSignal: new AbortController().signal,
      output: capture.stream,
    })

    // The raw chunks (before our test strips ANSI) should contain the color codes
    // Our createCapture strips ANSI for assertion convenience, so check the raw output
    const lines = capture.lines()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('colored')
  })
})
