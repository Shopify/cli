import {reportAnalyticsEvent} from './analytics.js'
import * as ruby from './ruby.js'
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
import {startAnalytics} from '../../private/node/analytics.js'
import {hashString} from '../../public/node/crypto.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {test, expect, describe, vi, beforeEach, afterEach, MockedFunction} from 'vitest'

vi.mock('./context/local.js')
vi.mock('./ruby.js')
vi.mock('./os.js')
vi.mock('../../store.js')
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
    vi.mocked(ruby.version).mockResolvedValue('3.1.1')
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
        ruby_version: '3.1.1',
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
        ruby_version: '3.1.1',
        node_version: process.version.replace('v', ''),
        is_employee: false,
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
})
