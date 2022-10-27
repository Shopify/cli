import {hashString} from './string.js'
import {getAnalyticsTunnelType, reportEvent, start} from './analytics.js'
import * as environment from './environment.js'
import {join as joinPath, dirname} from './path.js'
import * as os from './os.js'
import * as ruby from './public/node/ruby.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {getAppInfo} from './store.js'
import constants from './constants.js'
import {publishEvent} from './monorail.js'
import {inTemporaryDirectory, touch as touchFile, mkdir} from './file.js'
import {getListOfTunnelPlugins} from './plugins.js'
import {it, expect, describe, vi, beforeEach, afterEach, MockedFunction} from 'vitest'

describe('event tracking', () => {
  const currentDate = new Date(Date.UTC(2022, 1, 1, 10, 0, 0))
  let publishEventMock: MockedFunction<typeof publishEvent>

  beforeEach(() => {
    vi.setSystemTime(currentDate)
    vi.mock('./environment.js')
    vi.mock('./public/node/ruby.js')
    vi.mock('./os.js')
    vi.mock('./store.js')
    vi.mock('./string.js')

    vi.mock('./version.js')
    vi.mock('./monorail.js')
    vi.mock('./public/node/cli.js')
    vi.mocked(environment.local.isShopify).mockResolvedValue(false)
    vi.mocked(environment.local.isDevelopment).mockReturnValue(false)
    vi.mocked(environment.local.analyticsDisabled).mockReturnValue(false)
    vi.mocked(environment.local.ciPlatform).mockReturnValue({isCI: true, name: 'vitest'})
    vi.mocked(environment.local.macAddress).mockResolvedValue('macAddress')
    vi.mocked(hashString).mockReturnValue('hashed-macaddress')
    vi.mocked(environment.local.cloudEnvironment).mockReturnValue({platform: 'spin', editor: false})
    vi.mocked(ruby.version).mockResolvedValue('3.1.1')
    vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
    publishEventMock = vi.mocked(publishEvent).mockReturnValue(Promise.resolve({type: 'ok'}))
    vi.mock('./plugins.js', async () => {
      const plugins: any = await vi.importActual('./plugins.js')
      return {
        ...plugins,
        getListOfTunnelPlugins: vi.fn(),
      }
    })
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

  it('sends the expected data to Monorail with cached app info', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app', alias: 'alias'}
      vi.mocked(getAppInfo).mockResolvedValueOnce({
        appId: 'key1',
        orgId: '1',
        storeFqdn: 'domain1',
        directory: '/cached',
      })
      await start({commandContent, args, currentTime: currentDate.getTime() - 100})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [
          {
            name: '@shopify/built-in',
          },
          {
            name: 'a-custom-plugin',
          },
        ],
      } as any
      await reportEvent({config})
      // Then
      const version = await constants.versions.cliKit()
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

  it('sends the expected data to Monorail when there is an error message', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      await start({commandContent, args, currentTime: currentDate.getTime() - 100})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportEvent({config, errorMessage: 'Permission denied'})

      // Then
      const version = await constants.versions.cliKit()
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

  it('does nothing when analytics are disabled', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      vi.mocked(environment.local.analyticsDisabled).mockReturnValueOnce(true)
      const commandContent = {command: 'dev', topic: 'app'}
      await start({commandContent, args, currentTime: currentDate.getTime() - 100})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportEvent({config})

      // Then
      expect(publishEvent).not.toHaveBeenCalled()
    })
  })

  it('shows an error if something else fails', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const commandContent = {command: 'dev', topic: 'app'}
      vi.mocked(os.platformAndArch).mockImplementationOnce(() => {
        throw new Error('Boom!')
      })
      const outputMock = mockAndCaptureOutput()
      await start({commandContent, args})

      // When
      const config = {
        runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
        plugins: [],
      } as any
      await reportEvent({config})

      // Then
      expect(outputMock.debug()).toMatch('Failed to report usage analytics: Boom!')
    })
  })
})

describe('getAnalyticsTunnelType', () => {
  it('when no tunnelUrl is passed then should return undefined', async () => {
    // When
    const got = await getAnalyticsTunnelType({} as any, undefined as any)

    // Then
    expect(got).toBeUndefined()
  })

  it('when a localhost tunnelUrl is passed then should return localhost', async () => {
    // Given
    const tunnelUrl = 'https://localhost'

    // When
    const got = await getAnalyticsTunnelType({} as any, tunnelUrl)

    // Then
    expect(got).toBe('localhost')
  })

  it('return a provider in case tunnelUrl contains its name', async () => {
    // Given
    const tunnelUrl = 'https://www.existing-provider.com'
    vi.mocked(getListOfTunnelPlugins).mockResolvedValue({plugins: ['existing-provider']})

    // When
    const got = await getAnalyticsTunnelType({} as any, tunnelUrl)

    // Then
    expect(got).toBe('existing-provider')
  })

  it('return a custom in case tunnelUrl is not either localhost or included in the provider plugin list', async () => {
    // Given
    const tunnelUrl = 'https://www.custom-provider.com'
    vi.mocked(getListOfTunnelPlugins).mockResolvedValue({plugins: ['existing-provider']})

    // When
    const got = await getAnalyticsTunnelType({} as any, tunnelUrl)

    // Then
    expect(got).toBe('custom')
  })
})
