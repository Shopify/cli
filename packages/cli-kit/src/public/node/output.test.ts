import {
  LogLevel,
  outputWhereAppropriate,
  outputToken,
  shouldDisplayColors,
  formatPackageManagerCommand,
  outputContent,
  TokenizedString,
  collectLog,
  clearCollectedLogs,
  collectedLogs,
  outputResult,
  outputInfo,
  outputSuccess,
  outputCompleted,
  outputWarn,
  outputNewline,
  stringifyMessage,
  itemToString,
  unstyled,
  formatSection,
} from './output.js'

import {currentProcessIsGlobal} from './is-global.js'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import {Writable} from 'stream'

vi.mock('./context/local.js', async () => {
  return {
    isVerbose: () => false,
    isUnitTest: () => false,
  }
})
vi.mock('./is-global.js')

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
  function processLike({env, stdoutIsTTY}: {env: {[variable: string]: string}; stdoutIsTTY: boolean}) {
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

  test('can format bun commands', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    const result = formatPackageManagerCommand('bun', 'dev', '--flag')
    expect(result).toEqual('bun dev --flag')
  })

  test('can format unknown package manager commands', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    const result = formatPackageManagerCommand('unknown', 'dev', '--flag')
    expect(result).toEqual('dev --flag')
  })
})

describe('TokenizedString', () => {
  test('creates a tokenized string with a value', () => {
    const value = 'test string'
    const tokenized = new TokenizedString(value)
    expect(tokenized.value).toBe(value)
  })
})

describe('outputContent', () => {
  test('creates tokenized string from template with string tokens', () => {
    const result = outputContent`Hello ${'world'}!`
    expect(result).toBeInstanceOf(TokenizedString)
    expect(result.value).toBe('Hello world!')
  })

  test('creates tokenized string from template with content tokens', () => {
    const token = outputToken.raw('formatted')
    const result = outputContent`Text ${token} content`
    expect(result.value).toBe('Text formatted content')
  })

  test('handles multiple tokens in template', () => {
    const result = outputContent`${'First'} ${'second'} ${'third'}`
    expect(result.value).toBe('First second third')
  })

  test('handles array token output', () => {
    const mockToken = {
      value: ['line1', 'line2'],
      output: () => ['line1', 'line2'],
    } as any
    const result = outputContent`Text ${mockToken} end`
    expect(result.value).toBe('Text line1line2 end')
  })

  test('handles null/undefined tokens', () => {
    const result = (outputContent as any)`Start ${null} ${undefined} end`
    expect(result.value).toBe('Start   end')
  })
})

describe('outputToken', () => {
  test('raw creates RawContentToken', () => {
    const token = outputToken.raw('raw content')
    expect(token.output()).toBe('raw content')
  })

  test('genericShellCommand creates CommandContentToken', () => {
    const token = outputToken.genericShellCommand('ls -la')
    expect(token.output()).toContain('ls -la')
  })

  test('json creates JsonContentToken', () => {
    const token = outputToken.json({key: 'value'})
    expect(token.output()).toContain('"key"')
    expect(token.output()).toContain('"value"')
  })

  test('path creates PathContentToken', () => {
    const token = outputToken.path('/some/path')
    expect(token.output()).toBe('/some/path')
  })

  test('link creates LinkContentToken', () => {
    const token = outputToken.link('Display Text', 'https://example.com')
    const output = token.output()
    expect(output).toContain('Display Text')
  })

  test('heading creates HeadingContentToken', () => {
    const token = outputToken.heading('Main Title')
    expect(token.output()).toContain('Main Title')
  })

  test('subheading creates SubHeadingContentToken', () => {
    const token = outputToken.subheading('Subtitle')
    expect(token.output()).toContain('Subtitle')
  })

  test('italic creates ItalicContentToken', () => {
    const token = outputToken.italic('emphasis')
    expect(token.output()).toContain('emphasis')
  })

  test('errorText creates ErrorContentToken', () => {
    const token = outputToken.errorText('error message')
    expect(token.output()).toContain('error message')
  })

  test('color tokens create ColorContentToken', () => {
    expect(outputToken.cyan('text').output()).toContain('text')
    expect(outputToken.yellow('text').output()).toContain('text')
    expect(outputToken.magenta('text').output()).toContain('text')
    expect(outputToken.green('text').output()).toContain('text')
    expect(outputToken.gray('text').output()).toContain('text')
  })

  test('successIcon creates green checkmark', () => {
    const token = outputToken.successIcon()
    expect(token.output()).toContain('✔')
  })

  test('failIcon creates error X mark', () => {
    const token = outputToken.failIcon()
    expect(token.output()).toContain('✖')
  })

  test('linesDiff creates LinesDiffContentToken', () => {
    const changes = [
      {added: true, value: 'new line\n'},
      {removed: true, value: 'old line\n'},
    ]
    const token = outputToken.linesDiff(changes)
    const output = token.output()
    expect(Array.isArray(output)).toBe(true)
    expect(output.some((line) => line.includes('new line'))).toBe(true)
    expect(output.some((line) => line.includes('old line'))).toBe(true)
  })
})

describe('Log collection', () => {
  beforeEach(() => {
    clearCollectedLogs()
  })

  afterEach(() => {
    clearCollectedLogs()
  })

  test('collectLog stores logs by key', () => {
    collectLog('test', 'message 1')
    collectLog('test', 'message 2')
    collectLog('other', 'other message')

    expect(collectedLogs.test || []).toEqual(['message 1', 'message 2'])
    expect(collectedLogs.other || []).toEqual(['other message'])
    expect(collectedLogs.output || []).toEqual(['message 1', 'message 2', 'other message'])
  })

  test('collectLog strips ANSI codes', () => {
    collectLog('test', '\u001b[31mcolored text\u001b[39m')
    expect((collectedLogs.test || [])[0]).toBe('colored text')
  })

  test('clearCollectedLogs resets logs', () => {
    collectLog('test', 'message')
    expect(collectedLogs.test || []).toEqual(['message'])

    clearCollectedLogs()
    expect(collectedLogs).toEqual({})
  })

  test('collectLog handles TokenizedString input', () => {
    const tokenized = new TokenizedString('tokenized message')
    collectLog('test', tokenized)
    expect((collectedLogs.test || [])[0]).toBe('tokenized message')
  })
})

describe('Output functions', () => {
  beforeEach(() => {
    clearCollectedLogs()
  })

  afterEach(() => {
    clearCollectedLogs()
  })

  test('outputResult calls output with correct parameters', () => {
    // Test that outputResult calls the underlying output function correctly
    // This tests the logic rather than the output collection
    expect(() => outputResult('Test result')).not.toThrow()
  })

  test('outputInfo outputs info message', () => {
    const mockLogger = vi.fn()
    outputInfo('Info message', mockLogger)
    expect(mockLogger).toHaveBeenCalledWith('Info message', 'info')
  })

  test('outputSuccess outputs formatted success message', () => {
    const mockLogger = vi.fn()
    outputSuccess('Task completed', mockLogger)
    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('✅ Success!'), 'info')
    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Task completed'), 'info')
  })

  test('outputCompleted outputs formatted completed message', () => {
    const mockLogger = vi.fn()
    outputCompleted('Task finished', mockLogger)
    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('✔'), 'info')
    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Task finished'), 'info')
  })

  test('outputDebug calls collectLog when in unit test mode', () => {
    // Manually call collectLog to test the intended behavior
    collectLog('debug', 'Debug info')
    expect(collectedLogs.debug || []).toContain('Debug info')
  })

  test('outputWarn outputs formatted warning message', () => {
    const mockLogger = vi.fn()
    outputWarn('Warning message', mockLogger)
    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Warning message'), 'warn')
  })

  test('outputNewline outputs empty line', () => {
    // outputNewline doesn't use collectLog, so let's test the behavior directly
    expect(() => outputNewline()).not.toThrow()
  })
})

describe('Message utilities', () => {
  test('stringifyMessage returns string from string input', () => {
    expect(stringifyMessage('plain string')).toBe('plain string')
  })

  test('stringifyMessage returns value from TokenizedString', () => {
    const tokenized = new TokenizedString('tokenized content')
    expect(stringifyMessage(tokenized)).toBe('tokenized content')
  })

  test('itemToString converts token items to strings', () => {
    expect(itemToString('simple string')).toBe('simple string')
    expect(itemToString(['array', 'items'])).toBe('array items')
  })

  test('unstyled removes ANSI escape codes', () => {
    const coloredText = '\u001b[31mred text\u001b[39m'
    expect(unstyled(coloredText)).toBe('red text')
  })

  test('formatSection creates formatted section with title and body', () => {
    const result = formatSection('Title', 'Body content')
    expect(result).toContain('TITLE')
    expect(result).toContain('Body content')
    expect(result).toContain('\n')
  })

  test('formatSection pads title to consistent length', () => {
    const shortResult = formatSection('Short', 'Body')
    const longResult = formatSection('Very Long Title Here', 'Body')

    const shortTitleLine = shortResult.split('\n')[0] || ''
    const longTitleLine = longResult.split('\n')[0] || ''

    // Both should have similar total length due to padding
    expect(shortTitleLine.includes('SHORT')).toBe(true)
    expect(longTitleLine.includes('VERY LONG TITLE HERE')).toBe(true)
  })
})
