import {errorHandler, cleanStackFrameFilePath, addBugsnagMetadata, sendErrorToBugsnag} from './error-handler.js'
import {ciPlatform, cloudEnvironment, isUnitTest, macAddress} from './context/local.js'
import {mockAndCaptureOutput} from './testing/output.js'
import * as error from './error.js'
import {hashString} from '../../public/node/crypto.js'
import {settings} from '@oclif/core'
import {beforeEach, describe, expect, test, vi} from 'vitest'

const onNotify = vi.fn()

vi.mock('process')
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
vi.mock('./context/local.js')
vi.mock('../../public/node/crypto.js')
vi.mock('@oclif/core', () => ({
  settings: {
    debug: false,
  },
  Interfaces: {},
}))

beforeEach(() => {
  vi.mocked(ciPlatform).mockReturnValue({isCI: true, name: 'vitest', metadata: {}})
  vi.mocked(macAddress).mockResolvedValue('macAddress')
  vi.mocked(cloudEnvironment).mockReturnValue({platform: 'localhost', editor: false})
  vi.mocked(hashString).mockReturnValue('hashed-macaddress')
  vi.mocked(isUnitTest).mockReturnValue(true)
  onNotify.mockClear()
  delete process.env.SHOPIFY_SERVICE_ENV
  vi.mocked(settings).debug = false
})

describe('errorHandler', async () => {
  test('finishes the execution without exiting the proccess when cancel execution exception is raised', async () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)

    // When
    await errorHandler(new error.CancelExecution())

    // Then
    expect(process.exit).toBeCalledTimes(0)
  })

  test('finishes the execution without exiting the proccess and display a custom message when cancel execution exception is raised with a message', async () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)
    const outputMock = mockAndCaptureOutput()

    // When
    await errorHandler(new error.CancelExecution('Custom message'))

    // Then
    expect(outputMock.info()).toMatch('✨  Custom message')
    expect(process.exit).toBeCalledTimes(0)
  })
})

describe('bugsnag stack cleaning', () => {
  test.each([
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
  test('includes public data', async () => {
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

describe('skips sending errors to Bugsnag', () => {
  test('when SHOPIFY_SERVICE_ENV is local', async () => {
    // Given
    process.env.SHOPIFY_SERVICE_ENV = 'local'
    const mockOutput = mockAndCaptureOutput()
    const toThrow = new Error('In test')

    // When
    const res = await sendErrorToBugsnag(toThrow, 'unexpected_error')

    // Then
    expect(res.reported).toEqual(false)
    expect(res.error).toEqual(toThrow)
    expect(res.unhandled).toBeUndefined()
    expect(onNotify).not.toHaveBeenCalled()
    expect(mockOutput.debug()).toMatch('Skipping Bugsnag report')
  })

  test('when settings.debug is true', async () => {
    // Given
    vi.mocked(settings).debug = true
    const mockOutput = mockAndCaptureOutput()
    const toThrow = new Error('In test')

    // When
    const res = await sendErrorToBugsnag(toThrow, 'unexpected_error')

    // Then
    expect(res.reported).toEqual(false)
    expect(res.error).toEqual(toThrow)
    expect(res.unhandled).toBeUndefined()
    expect(onNotify).not.toHaveBeenCalled()
    expect(mockOutput.debug()).toMatch('Skipping Bugsnag report')
  })
})

describe('sends errors to Bugsnag', () => {
  test('processes Error instances as unhandled', async () => {
    const toThrow = new Error('In test')
    const res = await sendErrorToBugsnag(toThrow, 'unexpected_error')
    expect(res.reported).toEqual(true)
    expect(res.unhandled).toEqual(true)

    const {error} = res as any

    expect(error.stack).toMatch(/^Error: In test/)
    expect(error.stack).not.toEqual(toThrow.stack)
    expect(onNotify).toHaveBeenCalledWith(res.error)
  })

  test('processes string instances', async () => {
    const res = await sendErrorToBugsnag('In test' as any, 'unexpected_error')
    expect(res.reported).toEqual(true)
    const {error} = res as any
    expect(error.stack).toMatch(/^Error: In test/)
    expect(onNotify).toHaveBeenCalledWith(res.error)
  })

  test('processes AbortErrors as handled', async () => {
    const res = await sendErrorToBugsnag(new error.AbortError('In test'), 'expected_error')
    expect(res.reported).toEqual(true)
    expect(res.unhandled).toEqual(false)
    expect(onNotify).toHaveBeenCalledWith(res.error)
  })

  test.each([null, undefined, {}, {message: 'nope'}])('deals with strange things to throw %s', async (throwable) => {
    const res = await sendErrorToBugsnag(throwable, 'unexpected_error')
    expect(res.reported).toEqual(false)
    expect(onNotify).not.toHaveBeenCalled()
  })

  test('do not throw an error if Bugsnag fails, but just log it', async () => {
    // Given
    onNotify.mockImplementationOnce(() => {
      throw new Error('Bugsnag is down')
    })
    const toThrow = new Error('In test')
    const mockOutput = mockAndCaptureOutput()

    // When
    const res = await sendErrorToBugsnag(toThrow, 'unexpected_error')

    // Then
    expect(res.reported).toEqual(false)
    expect(res.error).toEqual(toThrow)
    expect(mockOutput.debug()).toMatch('Error reporting to Bugsnag: Error: Bugsnag is down')
  })
})
