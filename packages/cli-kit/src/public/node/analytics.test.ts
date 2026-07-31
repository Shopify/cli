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
import {addPublicMetadata, addSensitiveMetadata} from './metadata.js'
import {sendErrorToBugsnag} from './error-handler.js'
import {hashString} from './crypto.js'
import * as store from '../../private/node/analytics/storage.js'
import {startAnalytics} from '../../private/node/analytics.js'
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
vi.mock('./error-handler.js')
// Rate limiting can short-circuit reporting, which would make these tests depend
// on how many times the suite has run locally today.
vi.mock('../../private/node/conf-store.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../private/node/conf-store.js')>()),
  runWithRateLimit: vi.fn(async ({task}: {task: () => Promise<void>}) => task()),
}))

function restoreEnvVariable(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

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
    vi.mocked(cloudEnvironment).mockReturnValue({platform: 'localhost', editor: false})
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
        env_cloud: 'localhost',
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

  test('uses a recorded command end time when reporting after postrun work', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      const startTime = currentDate.getTime() - 100
      const commandEndTime = currentDate.getTime()
      await startAnalytics({commandContent, args, currentTime: startTime})
      await addSensitiveMetadata(() => ({
        commandStartOptions: {
          startTime,
          endTime: commandEndTime,
          startCommand: commandContent.command,
          startArgs: args,
        },
      }))
      vi.setSystemTime(new Date(commandEndTime + 60000))

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      expect(publishEventMock).toHaveBeenCalledOnce()
      expect(publishEventMock.mock.calls[0]![1]).toMatchObject({
        time_start: startTime,
        time_end: commandEndTime,
        total_time: 100,
      })
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
      const argsWithPassword = args.concat(['--password', 'shptka_abc123', '--store-password', 'store-secret'])
      await startAnalytics({commandContent, args: argsWithPassword, currentTime: currentDate.getTime() - 100})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      const expectedPayloadSensitive = {
        args: expect.stringMatching(/.*password \*\*\*\*\*.*store-password \*\*\*\*\*/),
        metadata: expect.anything(),
      }
      expect(publishEventMock).toHaveBeenCalledOnce()
      expect(publishEventMock.mock.calls[0]![2]).toMatchObject(expectedPayloadSensitive)
    })
  })

  test('does not send store password environment flags to Monorail', async () => {
    await inProjectWithFile('package.json', async (args) => {
      const commandContent = {command: 'dev', topic: 'app'}
      await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})
      await addSensitiveMetadata(() => ({
        environmentFlags: JSON.stringify({'store-password': 'store-secret'}),
      }))

      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      expect(publishEventMock).toHaveBeenCalledOnce()
      expect(publishEventMock.mock.calls[0]![2]).toMatchObject({
        cmd_all_environment_flags: JSON.stringify({'store-password': '*****'}),
      })
    })
  })

  async function withEnvironment(variables: {[key: string]: string}, execute: () => Promise<void>): Promise<void> {
    const originalValues = Object.keys(variables).map((key): [string, string | undefined] => [key, process.env[key]])
    Object.entries(variables).forEach(([key, value]) => {
      process.env[key] = value
    })

    try {
      await execute()
    } finally {
      originalValues.forEach(([key, value]) => restoreEnvVariable(key, value))
    }
  }

  // Callers set their own SHOPIFY_* variable to identify themselves, so the field
  // has to keep reporting names it doesn't know about -- SHOPIFY_INVOKED_BY comes
  // from shopify-function-test-helpers, outside this repo.
  test('sends SHOPIFY_ environment variables other than credentials', async () => {
    await withEnvironment(
      {
        SHOPIFY_CLI_AGENT: 'some-agent',
        SHOPIFY_INVOKED_BY: 'function-test-helpers',
        SHOPIFY_CLI_PARTNERS_TOKEN: 'partners_secret',
        SHOPIFY_PROXY_KEY: 'proxy_key_secret',
        NOT_SHOPIFY_VAR: 'should_not_appear',
      },
      async () => {
        await inProjectWithFile('package.json', async (args) => {
          const commandContent = {command: 'dev', topic: 'app'}
          await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})

          // When
          const config = {
            runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
            plugins: [],
          } as any
          await reportAnalyticsEvent({config, exitMode: 'ok'})

          // Then
          const sensitivePayload = publishEventMock.mock.calls[0]![2]
          expect(publishEventMock).toHaveBeenCalledOnce()

          const shopifyVars = JSON.parse(sensitivePayload.env_shopify_variables as string)
          expect(shopifyVars).toMatchObject({
            SHOPIFY_CLI_AGENT: 'some-agent',
            SHOPIFY_INVOKED_BY: 'function-test-helpers',
          })
          // `key` counts as a credential marker for environment variables:
          // SHOPIFY_PROXY_KEY holds a signed token.
          expect(shopifyVars).not.toHaveProperty('SHOPIFY_CLI_PARTNERS_TOKEN')
          expect(shopifyVars).not.toHaveProperty('SHOPIFY_PROXY_KEY')
          expect(shopifyVars).not.toHaveProperty('NOT_SHOPIFY_VAR')
        })
      },
    )
  })

  // The allowlist keeps these out of env_shopify_variables, but they should not
  // reach the payload through any other field either. Kept in sync with the
  // credentials in `environmentVariables` in private/node/constants.ts.
  test('does not send credential environment variables anywhere in the payload', async () => {
    const credentials = {
      SHOPIFY_APP_AUTOMATION_TOKEN: 'app_automation_secret',
      SHOPIFY_CLI_PARTNERS_TOKEN: 'partners_secret',
      SHOPIFY_CLI_IDENTITY_TOKEN: 'identity_secret',
      SHOPIFY_CLI_REFRESH_TOKEN: 'refresh_secret',
      SHOPIFY_CLI_THEME_TOKEN: 'theme_secret',
      SHOPIFY_FLAG_STORE_PASSWORD: 'store_password_secret',
    }

    await withEnvironment(credentials, async () => {
      await inProjectWithFile('package.json', async (args) => {
        // Given
        const commandContent = {command: 'dev', topic: 'app'}
        await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})

        // When
        const config = {
          runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
          plugins: [],
        } as any
        await reportAnalyticsEvent({config, exitMode: 'ok'})

        // Then
        expect(publishEventMock).toHaveBeenCalledOnce()
        const [, publicPayload, sensitivePayload] = publishEventMock.mock.calls[0]!
        const serializedPayload = JSON.stringify({publicPayload, sensitivePayload})
        Object.values(credentials).forEach((secret) => {
          expect(serializedPayload).not.toContain(secret)
        })
      })
    })
  })

  // The payload is printed by outputDebug even when analytics are disabled, so
  // asserting on the payload object alone would miss this sink.
  test('does not print credentials when analytics are disabled', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      vi.mocked(analyticsDisabled).mockReturnValue(true)
      const commandContent = {command: 'dev', topic: 'app'}
      const argsWithCredentials = args.concat(['--client-secret', 'client_secret_value'])
      await startAnalytics({commandContent, args: argsWithCredentials, currentTime: currentDate.getTime() - 100})
      const outputMock = mockAndCaptureOutput()

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      const debugOutput = outputMock.debug()
      expect(debugOutput).toMatch('Skipping command analytics, payload:')
      expect(debugOutput).not.toContain('client_secret_value')
    })
  })

  test('does not send credentials passed as flags to Monorail', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      const argsWithCredentials = args.concat([
        '--client-secret',
        'client_secret_value',
        '--token=token_value',
        '--password',
        'plain_password_value',
      ])
      await startAnalytics({commandContent, args: argsWithCredentials, currentTime: currentDate.getTime() - 100})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      expect(publishEventMock).toHaveBeenCalledOnce()
      const reportedArgs = publishEventMock.mock.calls[0]![2].args as string
      expect(reportedArgs).toContain('--client-secret *****')
      expect(reportedArgs).toContain('--token=*****')
      expect(reportedArgs).toContain('--password *****')
      expect(reportedArgs).not.toContain('client_secret_value')
      expect(reportedArgs).not.toContain('token_value')
      expect(reportedArgs).not.toContain('plain_password_value')
    })
  })

  // Values that used to be hard to delimit once the arguments had been joined
  // into one string: quotes and backslashes are escaped by JSON, and a space
  // makes the end of the value ambiguous.
  test.each([
    ['is empty', ''],
    ['contains quotes', '"cs_secret_value"'],
    ['contains a backslash', 'cs\\secret_value'],
    ['contains a space', '"cs secret_value"'],
  ])('redacts a credential flag whose value %s', async (_description, credentialValue) => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      await startAnalytics({
        commandContent,
        args: args.concat(['--client-secret', credentialValue]),
        currentTime: currentDate.getTime() - 100,
      })

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      expect(publishEventMock).toHaveBeenCalledOnce()
      expect(sendErrorToBugsnag).not.toHaveBeenCalled()
      const reportedArgs = publishEventMock.mock.calls[0]![2].args as string
      expect(reportedArgs).toContain('--client-secret *****')
      expect(reportedArgs).not.toContain('secret_value')
    })
  })

  // `metadata` is serialised JSON, and a plugin is free to put serialised JSON
  // inside it, so credential keys can sit more than one escaping level deep.
  test('does not send credentials nested inside serialized metadata', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})
      await addSensitiveMetadata(() => ({
        environmentFlags: JSON.stringify({nested: JSON.stringify({'client-secret': 'nested_secret_value'})}),
      }))

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      expect(publishEventMock).toHaveBeenCalledOnce()
      const environmentFlags = publishEventMock.mock.calls[0]![2].cmd_all_environment_flags as string
      expect(environmentFlags).not.toContain('nested_secret_value')
      expect(JSON.parse(JSON.parse(environmentFlags).nested)).toStrictEqual({'client-secret': '*****'})
    })
  })

  test('keeps reporting the auth method, which is not a credential', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      await startAnalytics({commandContent, args, currentTime: currentDate.getTime() - 100})
      setLastSeenAuthMethod('partners_token')

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportAnalyticsEvent({config, exitMode: 'ok'})

      // Then
      expect(publishEventMock.mock.calls[0]![1]).toMatchObject({env_auth_method: 'partners_token'})
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

  test('reports telemetry failures to Bugsnag', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      const telemetryError = new Error('OTLP endpoint unavailable')
      vi.mocked(os.platformAndArch).mockImplementationOnce(() => {
        throw telemetryError
      })
      vi.mocked(sendErrorToBugsnag).mockResolvedValue({
        error: telemetryError,
        reported: true,
        unhandled: false,
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
      expect(sendErrorToBugsnag).toHaveBeenCalledOnce()
      expect(sendErrorToBugsnag).toHaveBeenCalledWith(telemetryError, 'expected_error')
      expect(outputMock.debug()).toMatch('Failed to report usage analytics: OTLP endpoint unavailable')
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
