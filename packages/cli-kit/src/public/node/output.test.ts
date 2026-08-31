import {
  collectedLogs,
  clearCollectedLogs,
  LogLevel,
  outputDebug,
  outputCompleted,
  outputInfo,
  outputNewline,
  outputSuccess,
  outputWarn,
  outputWhereAppropriate,
  outputToken,
  shouldDisplayColors,
  formatPackageManagerCommand,
} from './output.js'

import {runWithCommandEvents} from './command-events.js'
import {currentProcessIsGlobal} from './is-global.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Writable} from 'stream'

const isVerboseMock = vi.hoisted(() => vi.fn(() => false))
const isUnitTestMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('./context/local.js', async () => {
  return {
    isVerbose: isVerboseMock,
    isUnitTest: isUnitTestMock,
  }
})
vi.mock('./is-global.js')

beforeEach(() => {
  isVerboseMock.mockReturnValue(false)
  isUnitTestMock.mockReturnValue(false)
  clearCollectedLogs()
})

describe('Output helpers', () => {
  test('can format dependency manager commands with flags', () => {
    expect(outputToken.packagejsonScript('yarn', 'dev', '--reset').value).toEqual('yarn dev --reset')
    expect(outputToken.packagejsonScript('npm', 'dev', '--reset').value).toEqual('npm run dev -- --reset')
    expect(outputToken.packagejsonScript('pnpm', 'dev', '--reset').value).toEqual('pnpm dev --reset')
    expect(outputToken.packagejsonScript('unknown', 'dev', '--reset').value).toEqual('dev --reset')
  })
  test('can format dependency manager commands without flags', () => {
    expect(outputToken.packagejsonScript('yarn', 'dev').value).toEqual('yarn dev')
    expect(outputToken.packagejsonScript('npm', 'dev').value).toEqual('npm run dev')
    expect(outputToken.packagejsonScript('pnpm', 'dev').value).toEqual('pnpm dev')
    expect(outputToken.packagejsonScript('unknown', 'dev').value).toEqual('dev')
  })
})

describe('Color disabling', () => {
  function processLike({env, stdoutIsTTY}: {env: Record<string, string>; stdoutIsTTY: boolean}) {
    const pseudoProcess = {
      ...process,
      env,
      stdout: Object.create(process.stdout),
    }
    pseudoProcess.stdout.isTTY = stdoutIsTTY
    return pseudoProcess
  }

  test('enables colors by default', () => {
    expect(shouldDisplayColors(processLike({env: {}, stdoutIsTTY: true}))).toEqual(true)
  })

  test('disables colors when in a non-TTY environment', () => {
    expect(shouldDisplayColors(processLike({env: {}, stdoutIsTTY: false}))).toEqual(false)
  })

  test('disables colors when FORCE_COLOR is truthy', () => {
    expect(shouldDisplayColors(processLike({env: {FORCE_COLOR: '1'}, stdoutIsTTY: true}))).toEqual(true)
  })

  test('enables colors when FORCE_COLOR is falsy', () => {
    expect(shouldDisplayColors(processLike({env: {FORCE_COLOR: '0'}, stdoutIsTTY: true}))).toEqual(false)
  })

  test('enables colors when FORCE_COLOR is truthy even in a non-TTY environment', () => {
    expect(shouldDisplayColors(processLike({env: {FORCE_COLOR: '1'}, stdoutIsTTY: false}))).toEqual(true)
  })
})

describe('outputWhereAppropriate', () => {
  test('passes the logLevel to the logger function', () => {
    const mockLogger = vi.fn()
    const message = 'Test message'
    const logLevel: LogLevel = 'info'

    outputWhereAppropriate(logLevel, mockLogger, message)
    expect(mockLogger).toHaveBeenCalledWith(message, logLevel)
  })

  test('writes the message to the logger if it is a Writable', () => {
    const message = 'Test message'
    const logLevel: LogLevel = 'info'
    const mockLogger = new Writable({
      write: vi.fn(),
    })
    vi.spyOn(mockLogger, 'write')
    outputWhereAppropriate(logLevel, mockLogger, message)
    expect(mockLogger.write).toHaveBeenCalledWith(message)
  })
})

describe('outputDebug', () => {
  test('collects debug logs during unit tests', () => {
    // Given
    const logger = vi.fn()
    isUnitTestMock.mockReturnValue(true)

    // When
    outputDebug('debug message', logger)

    // Then
    expect(collectedLogs.debug).toEqual(['debug message'])
    expect(logger).not.toHaveBeenCalled()
  })

  test('skips timestamp and logger work when debug output is disabled', () => {
    // Given
    const logger = vi.fn()
    const toISOStringSpy = vi.spyOn(Date.prototype, 'toISOString')

    try {
      // When
      outputDebug('debug message', logger)

      // Then
      expect(toISOStringSpy).not.toHaveBeenCalled()
      expect(logger).not.toHaveBeenCalled()
    } finally {
      toISOStringSpy.mockRestore()
    }
  })
})

describe('JSON command diagnostics', () => {
  test.each([
    {output: outputDebug, level: 'debug'},
    {output: outputInfo, level: 'info'},
    {output: outputSuccess, level: 'info'},
    {output: outputCompleted, level: 'info'},
    {output: outputWarn, level: 'warning'},
  ] as const)('emits output helpers as $level diagnostics', ({output, level}) => {
    const sink = vi.fn()
    if (level === 'debug') isVerboseMock.mockReturnValue(true)

    runWithCommandEvents({sink, outputMode: 'json', clock: () => new Date('2026-08-26T12:00:00.000Z')}, () =>
      output('Diagnostic message'),
    )

    expect(sink).toHaveBeenCalledWith({
      type: 'diagnostic',
      timestamp: '2026-08-26T12:00:00.000Z',
      level,
      message: 'Diagnostic message',
    })
  })

  test('preserves debug verbosity filtering', () => {
    const sink = vi.fn()

    runWithCommandEvents({sink, outputMode: 'json'}, () => outputDebug('Hidden diagnostic'))

    expect(sink).not.toHaveBeenCalled()
  })

  test('does not turn output sent to a custom logger into a command event', () => {
    const sink = vi.fn()
    const logger = vi.fn()

    runWithCommandEvents({sink, outputMode: 'json'}, () => outputInfo('Stream message', logger))

    expect(sink).not.toHaveBeenCalled()
    expect(logger).toHaveBeenCalledWith('Stream message', 'info')
  })

  test('does not emit blank diagnostics', () => {
    const sink = vi.fn()

    runWithCommandEvents({sink, outputMode: 'json'}, () => outputInfo('\n'))

    expect(sink).not.toHaveBeenCalled()
  })

  test('suppresses standalone newlines', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    runWithCommandEvents({outputMode: 'json'}, () => outputNewline())

    expect(stderrWrite).not.toHaveBeenCalled()
  })
})

describe('formatPackageManagerCommand', () => {
  test('can format yarn commands', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)

    // When
    const result = formatPackageManagerCommand('yarn', 'shopify app dev', '--reset')

    // Then
    expect(result).toEqual('yarn shopify app dev --reset')
  })

  test('can format pnpm commands', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)

    // When
    const result = formatPackageManagerCommand('pnpm', 'shopify app dev', '--reset')

    // Then
    expect(result).toEqual('pnpm shopify app dev --reset')
  })

  test('can format npm commands', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)

    // When
    const result = formatPackageManagerCommand('npm', 'shopify app dev', '--reset')

    // Then
    expect(result).toEqual('npm run shopify app dev -- --reset')
  })

  test('can format global commands', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)

    // When
    const result = formatPackageManagerCommand('npm', 'shopify app dev', '--reset')

    // Then
    expect(result).toEqual('shopify app dev --reset')
  })
})
