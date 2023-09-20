import {LogLevel, outputWhereAppropriate, outputToken, shouldDisplayColors} from './output.js'

import {describe, expect, test, vi} from 'vitest'
import {Writable} from 'stream'

vi.mock('./context/local.js', async () => {
  return {
    isVerbose: () => false,
    isUnitTest: () => false,
  }
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
