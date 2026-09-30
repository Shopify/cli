import {collectedLogs, clearCollectedLogs} from '../output.js'
import {resetMemoizedIsUnitTest} from '../context/local.js'
import {environmentVariables} from '../../../private/node/constants.js'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

interface OutputMock {
  output: () => string
  info: () => string
  debug: () => string
  success: () => string
  completed: () => string
  warn: () => string
  error: () => string
  clear: () => void
}

interface StandardStreamsMock {
  stdout: () => string
  stderr: () => string
  restore: () => void
}

export interface CapturedStandardStreams {
  stdout: () => string
  stderr: () => string
}

/**
 * Runs a callback with process stdout/stderr captured and unit-test output suppression disabled,
 * so tests can assert on what a command actually writes to the standard streams.
 *
 * The callback receives accessors instead of the function returning captured output so that
 * assertions remain possible when the callback throws (for example commands that abort).
 * Streams, console.warn and unit-test detection are restored afterwards.
 * Not safe for concurrent tests.
 *
 * @param run - Callback receiving accessors for the captured stdout and stderr.
 * @returns The value returned by the callback.
 */
export async function withCapturedStandardStreams<T>(
  run: (streams: CapturedStandardStreams) => T | Promise<T>,
): Promise<T> {
  // Computed access on purpose: Vitest compile-replaces the literal process.env.SHOPIFY_UNIT_TEST expression.
  const previousUnitTestVariable = process.env[environmentVariables.unitTest]
  setUnitTestVariable('0')
  resetMemoizedIsUnitTest()
  const streams = mockAndCaptureStandardStreams()
  try {
    return await run({stdout: streams.stdout, stderr: streams.stderr})
  } finally {
    streams.restore()
    setUnitTestVariable(previousUnitTestVariable)
    resetMemoizedIsUnitTest()
  }
}

function setUnitTestVariable(value: string | undefined): void {
  if (value === undefined) {
    delete process.env[environmentVariables.unitTest]
  } else {
    process.env[environmentVariables.unitTest] = value
  }
}

/**
 * Captures writes to stdout and stderr, including console warnings intercepted by Vitest.
 * Call restore in a finally block. This replaces process globals and must not be used in concurrent tests.
 * Prefer withCapturedStandardStreams, which also disables unit-test output suppression while it runs.
 *
 * @returns Captured output and a function to restore the original writers.
 */
export function mockAndCaptureStandardStreams(): StandardStreamsMock {
  const stdout = captureStream(process.stdout)
  const stderr = captureStream(process.stderr)
  // Vitest intercepts console.warn before it reaches stderr; use Node's console to exercise the writer.
  // eslint-disable-next-line no-console
  const originalWarn = console.warn
  // eslint-disable-next-line no-console
  console.warn = new Console(process.stdout, process.stderr).warn

  return {
    stdout: stdout.output,
    stderr: stderr.output,
    restore: () => {
      // eslint-disable-next-line no-console
      console.warn = originalWarn
      stdout.restore()
      stderr.restore()
    },
  }
}

function captureStream(stream: NodeJS.WriteStream) {
  const chunks: Buffer[] = []
  const originalWrite = stream.write
  stream.write = (
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) => {
    const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8'
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding) : Buffer.from(chunk))
    const onWrite = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
    if (onWrite) queueMicrotask(() => onWrite())
    return true
  }

  return {
    output: () => Buffer.concat(chunks).toString('utf8'),
    restore: () => {
      stream.write = originalWrite
    },
  }
}

/**
 * Returns a set of functions to get the outputs ocurred during a test run.
 *
 * @returns An mock object with all the output functions.
 */ export function mockAndCaptureOutput(): OutputMock {
  return {
    output: () => (collectedLogs.output ?? []).join('\n'),
    info: () => (collectedLogs.info ?? []).join('\n'),
    debug: () => (collectedLogs.debug ?? []).join('\n'),
    success: () => (collectedLogs.success ?? []).join('\n'),
    completed: () => (collectedLogs.completed ?? []).join('\n'),
    warn: () => (collectedLogs.warn ?? []).join('\n'),
    error: () => (collectedLogs.error ?? []).join('\n'),
    clear: () => {
      clearCollectedLogs()
      // output.collectedLogs = {}
    },
  }
}
