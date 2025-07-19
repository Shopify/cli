import {
  errorHandler,
  cleanStackFrameFilePath,
  addBugsnagMetadata,
  sendErrorToBugsnag,
  getSliceNameAndId,
} from './error-handler.js'
import {ciPlatform, cloudEnvironment, isUnitTest, macAddress} from './context/local.js'
import {mockAndCaptureOutput} from './testing/output.js'
import * as error from './error.js'
import {hashString} from '../../public/node/crypto.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

const onNotify = vi.fn()

vi.mock('process')
vi.mock('@bugsnag/js', () => {
  return {
    default: {
      notify: vi.fn((reportedError: any, args: any, callback: any) => {
        onNotify(reportedError)
        callback(null)
      }),
      isStarted: () => true,
      start: vi.fn(),
    },
  }
})
vi.mock('./cli.js')
vi.mock('./context/local.js')
vi.mock('../../public/node/crypto.js')

beforeEach(() => {
  vi.mocked(ciPlatform).mockReturnValue({isCI: true, name: 'vitest', metadata: {}})
  vi.mocked(macAddress).mockResolvedValue('macAddress')
  vi.mocked(cloudEnvironment).mockReturnValue({platform: 'spin', editor: false})
  vi.mocked(hashString).mockReturnValue('hashed-macaddress')
  vi.mocked(isUnitTest).mockReturnValue(true)
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
    expect(process.exit).toBeCalledTimes(0)
    expect(outputMock.info()).toMatch('✨  Custom message')
  })

  test('finishes the execution without displaying output when abort silent error exception is raised', async () => {
    // Given
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)
    const outputMock = mockAndCaptureOutput()

    // When
    await errorHandler(new error.AbortSilentError())

    // Then
    expect(process.exit).toBeCalledTimes(0)
    expect(outputMock.info()).toMatch('')
  })
})

describe('cleanStackFrameFilePath', () => {
  test("removes the node_modules/ prefix from a file's path", async () => {
    // Given
    const filePath = '/some/path/node_modules/@shopify/cli-kit/index.js'

    // When
    const clean = cleanStackFrameFilePath({
      currentFilePath: filePath,
      projectRoot: '',
      pluginLocations: [],
    })

    // Then
    expect(clean).toMatch('@shopify/cli-kit/index.js')
  })

  test('strips the plugin path prefix', async () => {
    // Given
    const filePath = '/Users/john.doe/Library/Caches/node/pkg/743047e/node_modules/@shopify/theme/dist/index.js'
    const projectRoot = '/some/project'
    const pluginLocations = [
      {
        name: '@shopify/theme',
        pluginPath: '/Users/john.doe/Library/Caches/node/pkg/743047e/node_modules/@shopify/theme',
      },
    ]

    // When
    const clean = cleanStackFrameFilePath({
      currentFilePath: filePath,
      projectRoot,
      pluginLocations,
    })

    // Then
    expect(clean).toMatch('@shopify/theme/dist/index.js')
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

describe('sendErrorToBugsnag', () => {
  test('sends an non-empty error to bugsnag', async () => {
    // Given
    const toThrow = new Error('some error')

    // When
    const {reported, error, unhandled} = await sendErrorToBugsnag(toThrow, 'unexpected_error')

    // Then
    expect(reported).toEqual(true)
    expect((error as Error).message).toEqual('some error')
    expect(unhandled).toEqual(true)
    expect(onNotify).toHaveBeenCalledWith(toThrow)
  })

  test('sends a non empty string error to bugsnag', async () => {
    // Given
    const toThrow = 'error string'

    // When
    const {reported, error, unhandled} = await sendErrorToBugsnag(toThrow, 'unexpected_error')

    // Then
    expect(reported).toEqual(true)
    expect((error as Error).message).toEqual('error string')
    expect(unhandled).toEqual(true)
  })

  test('sends an empty string error to bugsnag', async () => {
    // Given
    const toThrow = ''

    // When
    const {reported, error, unhandled} = await sendErrorToBugsnag(toThrow, 'expected_error')

    // Then
    expect(reported).toEqual(false)
    expect((error as Error).message).toEqual('Unknown error')
    expect(unhandled).toEqual(undefined)
  })

  test('handles errors when sending to Bugsnag', async () => {
    // Given
    const Bugsnag = (await import('@bugsnag/js')).default as any
    // eslint-disable-next-line node/handle-callback-err
    vi.mocked(Bugsnag.notify).mockImplementationOnce((_err: any, _args: any, callback: any) => {
      callback(new Error('Bugsnag is down'))
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
    const Bugsnag = (await import('@bugsnag/js')).default as any
    const originalImpl = vi.mocked(Bugsnag.notify).getMockImplementation()
    vi.mocked(Bugsnag.notify).mockImplementationOnce(() => {
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

    // Restore original implementation
    vi.mocked(Bugsnag.notify).mockImplementation(originalImpl)
  })
})

describe('getSliceNameAndId', () => {
  const sliceTestCases = [
    // Known slices
    ['@shopify/theme', {slice_name: 'theme', slice_id: 'S-2d23f6'}],
    ['@shopify/cli-hydrogen', {slice_name: 'hydrogen', slice_id: 'S-156228'}],
    ['@shopify/store', {slice_name: 'bulk data', slice_id: 'S-1bc8f5'}],
    ['@shopify/app', {slice_name: 'app', slice_id: 'S-9988b6'}],
    // Default to CLI slice
    ['@shopify/unknown', {slice_name: 'cli', slice_id: 'S-f3a87a'}],
    ['', {slice_name: 'cli', slice_id: 'S-f3a87a'}],
    ['@other/plugin', {slice_name: 'cli', slice_id: 'S-f3a87a'}],
    // Partial matches
    ['@shopify/theme-check', {slice_name: 'theme', slice_id: 'S-2d23f6'}],
    ['@shopify/cli-hydrogen-extension', {slice_name: 'hydrogen', slice_id: 'S-156228'}],
  ] as const

  test.each(sliceTestCases)('returns correct slice for %s', (plugin, expected) => {
    expect(getSliceNameAndId(plugin)).toEqual(expected)
  })
})
