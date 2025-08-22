import {reportAnalyticsEvent, recordTiming, recordError, recordRetry, recordEvent} from './analytics.js'
import * as os from './os.js'
import {
  analyticsDisabled,
  ciPlatform,
  cloudEnvironment,
  isDevelopment,
  isShopify,
  isUnitTest,
  macAddress,
} from './context/local.js'
import {inTemporaryDirectory, touchFile, mkdir} from './fs.js'
import {joinPath, dirname} from './path.js'
import {publishMonorailEvent} from './monorail.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {addPublicMetadata} from './metadata.js'
import * as store from '../../private/node/analytics/storage.js'
import {startAnalytics} from '../../private/node/analytics.js'
import {hashString} from '../../public/node/crypto.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {setLastSeenAuthMethod, setLastSeenUserIdAfterAuth} from '../../private/node/session.js'
import {test, expect, describe, vi, beforeEach, afterEach, MockedFunction} from 'vitest'

vi.mock('./context/local.js')
vi.mock('./os.js')
vi.mock('../../store.js')
vi.mock('../../private/node/analytics/storage.js')
vi.mock('../../public/node/crypto.js')
vi.mock('../../version.js')
vi.mock('./monorail.js')
vi.mock('./cli.js')

describe('event tracking', () => {
  const currentDate = new Date(Date.UTC(2022, 1, 1, 10, 0, 0))
  let publishEventMock: MockedFunction<typeof publishMonorailEvent>

  beforeEach(() => {
    vi.setSystemTime(currentDate)
    vi.mocked(isShopify).mockResolvedValue(false)
    vi.mocked(isDevelopment).mockReturnValue(false)
    vi.mocked(analyticsDisabled).mockReturnValue(false)
    vi.mocked(ciPlatform).mockReturnValue({isCI: true, name: 'vitest', metadata: {}})
    vi.mocked(macAddress).mockResolvedValue('macAddress')
    vi.mocked(hashString).mockReturnValue('hashed-macaddress')
    vi.mocked(isUnitTest).mockReturnValue(true)
    vi.mocked(cloudEnvironment).mockReturnValue({platform: 'spin', editor: false})
    vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
    publishEventMock = vi.mocked(publishMonorailEvent).mockReturnValue(Promise.resolve({type: 'ok'}))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function inProjectWithFile(file: string, execute: (args: string[]) => Promise<void>): Promise<void> {
    await inTemporaryDirectory(async (tmpDir) => {
      const packageJsonPath = joinPath(tmpDir, `web/${file}`)
      await mkdir(dirname(packageJsonPath))
      await touchFile(packageJsonPath)
      await execute(['--path', tmpDir])
    })
  }

  test('sends the expected data to Monorail with cached app info', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app', alias: 'alias'}
      await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})
      setLastSeenAuthMethod('partners_token')
      setLastSeenUserIdAfterAuth('cached-user-id')

      // Log some timings from the command, confirm that submitted timings are always rounded down
      await addPublicMetadata(() => ({
        cmd_all_timing_network_ms: 30.00001,
        cmd_all_timing_prompts_ms: 20,
      }))

      // When
      const pluginsMap = new Map()
      pluginsMap.set('@shopify/built-in', {})
      pluginsMap.set('a-custom-plugin', {})
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: pluginsMap,
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})
      // Then
      const version = CLI_KIT_VERSION
      const expectedPayloadPublic = {
        command: commandContent.command,
        cmd_all_alias_used: commandContent.alias,
        cmd_all_topic: commandContent.topic,
        time_start: 1643709599900,
        time_end: 1643709600000,
        total_time: 100,
        success: true,
        uname: 'darwin arm64',
        cli_version: version,
        ruby_version: '',
        node_version: process.version.replace('v', ''),
        is_employee: false,
        env_plugin_installed_any_custom: true,
        env_plugin_installed_shopify: JSON.stringify(['@shopify/built-in']),
        env_device_id: 'hashed-macaddress',
        env_cloud: 'spin',
        cmd_all_exit: 'ok',
        cmd_all_timing_active_ms: 49,
        cmd_all_timing_network_ms: 30,
        cmd_all_timing_prompts_ms: 20,
        user_id: 'cached-user-id',
        env_auth_method: 'partners_token',
      }
      const expectedPayloadSensitive = {
        args: args.join(' '),
        metadata: expect.anything(),
        env_plugin_installed_all: JSON.stringify(['@shopify/built-in', 'a-custom-plugin']),
      }
      expect(publishEventMock).toHaveBeenCalledOnce()
      expect(publishEventMock.mock.calls[0]![1]).toMatchObject(expectedPayloadPublic)
      expect(publishEventMock.mock.calls[0]![2]).toMatchObject(expectedPayloadSensitive)
    })
  })

  test('sends the expected data to Monorail when there is an error message', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})
      setLastSeenUserIdAfterAuth('cached-user-id')

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, errorMessage: 'Permission denied', exitMode: 'unexpected_error'})

      // Then
      const version = CLI_KIT_VERSION
      const expectedPayloadPublic = {
        command: commandContent.command,
        time_start: 1643709599900,
        time_end: 1643709600000,
        total_time: 100,
        success: false,
        uname: 'darwin arm64',
        cli_version: version,
        ruby_version: '',
        node_version: process.version.replace('v', ''),
        is_employee: false,
        user_id: 'cached-user-id',
      }
      const expectedPayloadSensitive = {
        args: args.join(' '),
        error_message: 'Permission denied',
        metadata: expect.anything(),
      }
      expect(publishEventMock).toHaveBeenCalledOnce()
      expect(publishEventMock.mock.calls[0]![1]).toMatchObject(expectedPayloadPublic)
      expect(publishEventMock.mock.calls[0]![2]).toMatchObject(expectedPayloadSensitive)
    })
  })

  test('does not send passwords to Monorail', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      const argsWithPassword = args.concat(['--password', 'shptka_abc123'])
      await startAnalytics({commandContent, args: argsWithPassword, currentTime: currentDate.getTime() - 100})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      const expectedPayloadSensitive = {
        args: expect.stringMatching(/.*password \*\*\*\*\*/),
        metadata: expect.anything(),
      }
      expect(publishEventMock).toHaveBeenCalledOnce()
      expect(publishEventMock.mock.calls[0]![2]).toMatchObject(expectedPayloadSensitive)
    })
  })

  test('does nothing when analytics are disabled', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      vi.mocked(analyticsDisabled).mockReturnValueOnce(true)
      const commandContent = {command: 'dev', topic: 'app'}
      await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      expect(publishMonorailEvent).not.toHaveBeenCalled()
    })
  })

  test('shows an error if something else fails', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      vi.mocked(os.platformAndArch).mockImplementationOnce(() => {
        throw new Error('Boom!')
      })
      const outputMock = mockAndCaptureOutput()
      await startAnalytics({commandContent, args})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      expect(outputMock.debug()).toMatch('Failed to report usage analytics: Boom!')
    })
  })

  describe('recordTiming', () => {
    test('delegates to store.recordTiming', () => {
      // Given
      const eventName = 'test-timing-event'

      // When
      recordTiming(eventName)

      // Then
      expect(store.recordTiming).toHaveBeenCalledOnce()
      expect(store.recordTiming).toHaveBeenCalledWith(eventName)
    })

    test('passes through different event names correctly', () => {
      // When
      recordTiming('event-1')
      recordTiming('event-2')
      recordTiming('another-event')

      // Then
      expect(store.recordTiming).toHaveBeenCalledTimes(3)
      expect(store.recordTiming).toHaveBeenNthCalledWith(1, 'event-1')
      expect(store.recordTiming).toHaveBeenNthCalledWith(2, 'event-2')
      expect(store.recordTiming).toHaveBeenNthCalledWith(3, 'another-event')
    })
  })

  describe('recordError', () => {
    test('delegates to store.recordError with Error object', () => {
      // Given
      const error = new Error('Test error message')

      // When
      recordError(error)

      // Then
      expect(store.recordError).toHaveBeenCalledOnce()
      expect(store.recordError).toHaveBeenCalledWith(error)
    })

    test('delegates to store.recordError with string', () => {
      // Given
      const errorString = 'String error message'

      // When
      recordError(errorString)

      // Then
      expect(store.recordError).toHaveBeenCalledOnce()
      expect(store.recordError).toHaveBeenCalledWith(errorString)
    })

    test('delegates to store.recordError with arbitrary objects', () => {
      // Given
      const errorObj = {code: 'ERR_001', message: 'Custom error'}

      // When
      recordError(errorObj)

      // Then
      expect(store.recordError).toHaveBeenCalledOnce()
      expect(store.recordError).toHaveBeenCalledWith(errorObj)
    })

    test('passes through null and undefined', () => {
      // When
      recordError(null)
      recordError(undefined)

      // Then
      expect(store.recordError).toHaveBeenCalledTimes(2)
      expect(store.recordError).toHaveBeenNthCalledWith(1, null)
      expect(store.recordError).toHaveBeenNthCalledWith(2, undefined)
    })
  })

  describe('recordRetry', () => {
    test('delegates to store.recordRetry', () => {
      // Given
      const url = 'https://api.example.com/themes'
      const operation = 'upload'

      // When
      recordRetry(url, operation)

      // Then
      expect(store.recordRetry).toHaveBeenCalledOnce()
      expect(store.recordRetry).toHaveBeenCalledWith(url, operation)
    })

    test('passes through different URLs and operations', () => {
      // When
      recordRetry('https://api1.com', 'upload')
      recordRetry('https://api2.com', 'download')
      recordRetry('https://api3.com', 'sync')

      // Then
      expect(store.recordRetry).toHaveBeenCalledTimes(3)
      expect(store.recordRetry).toHaveBeenNthCalledWith(1, 'https://api1.com', 'upload')
      expect(store.recordRetry).toHaveBeenNthCalledWith(2, 'https://api2.com', 'download')
      expect(store.recordRetry).toHaveBeenNthCalledWith(3, 'https://api3.com', 'sync')
    })

    test('handles empty strings', () => {
      // When
      recordRetry('', '')

      // Then
      expect(store.recordRetry).toHaveBeenCalledOnce()
      expect(store.recordRetry).toHaveBeenCalledWith('', '')
    })
  })

  describe('recordEvent', () => {
    test('delegates to store.recordEvent', () => {
      // Given
      const eventName = 'custom-event'

      // When
      recordEvent(eventName)

      // Then
      expect(store.recordEvent).toHaveBeenCalledOnce()
      expect(store.recordEvent).toHaveBeenCalledWith(eventName)
    })

    test('passes through various event names', () => {
      // When
      recordEvent('theme-dev-started')
      recordEvent('file-watcher-connected')
      recordEvent('user-action:save')
      recordEvent('system-event:reload')

      // Then
      expect(store.recordEvent).toHaveBeenCalledTimes(4)
      expect(store.recordEvent).toHaveBeenNthCalledWith(1, 'theme-dev-started')
      expect(store.recordEvent).toHaveBeenNthCalledWith(2, 'file-watcher-connected')
      expect(store.recordEvent).toHaveBeenNthCalledWith(3, 'user-action:save')
      expect(store.recordEvent).toHaveBeenNthCalledWith(4, 'system-event:reload')
    })

    test('handles special characters in event names', () => {
      // When
      recordEvent('event:with:colons')
      recordEvent('event-with-dashes')
      recordEvent('event_with_underscores')
      recordEvent('event.with.dots')

      // Then
      expect(store.recordEvent).toHaveBeenCalledTimes(4)
    })
  })

  describe('public API integration', () => {
    test('all functions are properly exported and callable', () => {
      // When
      // Then
      expect(typeof recordTiming).toBe('function')
      expect(typeof recordError).toBe('function')
      expect(typeof recordRetry).toBe('function')
      expect(typeof recordEvent).toBe('function')
    })

    test('functions can be called in sequence', () => {
      // When
      recordEvent('operation-start')
      recordTiming('file-upload')
      recordRetry('https://api.example.com', 'upload')
      recordError(new Error('Upload failed'))
      recordTiming('file-upload')
      recordEvent('operation-end')

      // Then
      expect(store.recordEvent).toHaveBeenCalledTimes(2)
      expect(store.recordTiming).toHaveBeenCalledTimes(2)
      expect(store.recordRetry).toHaveBeenCalledTimes(1)
      expect(store.recordError).toHaveBeenCalledTimes(1)
    })
  })
})
