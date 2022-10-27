import {errorHandler, cleanStackFrameFilePath, addBugsnagMetadata, sendErrorToBugsnag} from './error-handler.js'
import * as environment from '../../environment.js'
import * as error from '../../error.js'
import * as outputMocker from '../../testing/output.js'
import {hashString} from '../../string.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const onNotify = vi.fn()
beforeEach(() => {
  vi.mock('node:process')
  vi.mock('@bugsnag/js', () => {
    return {
      default: {
        notify: (reportedError: any, args: any, callback: any) => {
          onNotify(reportedError)
          callback(null)
        },
        isStarted: () => true,
      },
    }
  })
  vi.mock('./cli.js')
  vi.mock('../../environment.js')
  vi.mock('../../string.js')
  vi.mocked(environment.local.ciPlatform).mockReturnValue({isCI: true, name: 'vitest'})
  vi.mocked(environment.local.macAddress).mockResolvedValue('macAddress')
  vi.mocked(environment.local.cloudEnvironment).mockReturnValue({platform: 'spin', editor: false})
  vi.mocked(hashString).mockReturnValue('hashed-macaddress')
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('errorHandler', () => {
  it('finishes the execution without exiting the proccess when cancel execution exception is raised', async () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)

    // When
    await errorHandler(new error.CancelExecution())

    // Then
    expect(process.exit).toBeCalledTimes(0)
  })

  it('finishes the execution without exiting the proccess and display a custom message when cancel execution exception is raised with a message', async () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)
    const outputMock = outputMocker.mockAndCaptureOutput()

    // When
    await errorHandler(new error.CancelExecution('Custom message'))

    // Then
    expect(outputMock.info()).toMatch('✨  Custom message')
    expect(process.exit).toBeCalledTimes(0)
  })

  it('finishes the execution gracefully and exits the proccess when abort silent exception', async () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)

    // When
    await errorHandler(new error.AbortSilent())

    // Then
    expect(process.exit).toBeCalledTimes(1)
    expect(process.exit).toBeCalledWith(1)
  })
})

describe('bugsnag stack cleaning', () => {
  it.each([
    ['dependency in relative path', 'cool-project/node_modules/deppy/foo/bar.ts', 'deppy/foo/bar.ts'],
    ['dependency in absolute path', '/Users/ju/Desktop/cool/node_modules/deppy/foo/bar.ts', 'deppy/foo/bar.ts'],
    ['plugin in project', 'node_modules/@plugin/name/foo/bar.ts', '@plugin/name/foo/bar.ts'],
    ['plugin outside project', '/global/node_modules/@plugin/global/foo/bar.ts', '@plugin/global/foo/bar.ts'],
    ['some relative path', 'users/own/code.ts', 'users/own/code.ts'],
    ['some absolute path', '/global/code.ts', '/global/code.ts'],
    [
      'plugin in a complex location',
      'node_modules/.something/@plugin+complex/@plugin/complex-path/foo/bar.ts',
      '@plugin/complex-path/foo/bar.ts',
    ],
  ])('%s', (_, path, result) => {
    expect(
      cleanStackFrameFilePath({
        currentFilePath: path,
        projectRoot: '/my/project',
        pluginLocations: [
          {
            name: '@plugin/name',
            pluginPath: '/my/project/node_modules/@plugin/name',
          },
          {
            name: '@plugin/global',
            pluginPath: '/global/node_modules/@plugin/global',
          },
          {
            name: '@plugin/complex-path',
            pluginPath: '/my/project/node_modules/.something/@plugin+complex/@plugin/complex-path',
          },
        ],
      }),
    ).toEqual(result)
  })
})

describe('bugsnag metadata', () => {
  it('includes public data', async () => {
    const event = {
      addMetadata: vi.fn(),
    }
    const mockConfig = {
      runHook: () => Promise.resolve({successes: []}),
      plugins: [],
    }
    await addBugsnagMetadata(event as any, mockConfig as any)
    expect(event.addMetadata).toHaveBeenCalled()
  })
})

describe('send to Bugsnag', () => {
  it('processes Error instances', async () => {
    const toThrow = new Error('In test')
    const res = await sendErrorToBugsnag(toThrow)
    expect(res.reported).toEqual(true)

    const {error} = res as any

    expect(error.stack).toMatch(/^Error: In test/)
    expect(error.stack).not.toEqual(toThrow.stack)
    expect(onNotify).toHaveBeenCalledWith(res.error)
  })

  it('processes string instances', async () => {
    const res = await sendErrorToBugsnag('In test' as any)
    expect(res.reported).toEqual(true)
    const {error} = res as any
    expect(error.stack).toMatch(/^Error: In test/)
    expect(onNotify).toHaveBeenCalledWith(res.error)
  })

  it('ignores fatals', async () => {
    const res = await sendErrorToBugsnag(new error.Abort('In test'))
    expect(res.reported).toEqual(false)
    expect(onNotify).not.toHaveBeenCalled()
  })

  it.each([null, undefined, {}, {message: 'nope'}])('deals with strange things to throw %s', async (throwable) => {
    const res = await sendErrorToBugsnag(throwable as any)
    expect(res.reported).toEqual(false)
    expect(onNotify).not.toHaveBeenCalled()
  })
})
