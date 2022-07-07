/* eslint-disable @typescript-eslint/naming-convention */
import {reportEvent, start} from './analytics.js'
import * as environment from './environment.js'
import {join as joinPath, dirname} from './path.js'
import * as http from './http.js'
import * as os from './os.js'
import * as ruby from './node/ruby.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {cliKitStore} from './store.js'
import constants from './constants.js'
import {inTemporaryDirectory, touch as touchFile, mkdir} from './file.js'
import {it, expect, describe, vi, beforeEach, afterEach} from 'vitest'

describe('event tracking', () => {
  const currentDate = new Date(Date.UTC(2022, 1, 1, 10, 0, 0))
  const expectedURL = 'https://monorail-edge.shopifysvc.com/v1/produce'
  const expectedHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': '1643709600000',
    'X-Monorail-Edge-Event-Sent-At-Ms': '1643709600000',
  }

  beforeEach(() => {
    vi.setSystemTime(currentDate)
    vi.mock('./environment.js')
    vi.mock('./node/ruby.js')
    vi.mock('./os.js')
    vi.mock('./store.js')

    vi.mock('./http.js')
    vi.mock('./version.js')
    vi.mocked(environment.local.isShopify).mockResolvedValue(false)
    vi.mocked(environment.local.isDebug).mockReturnValue(false)
    vi.mocked(environment.local.analyticsDisabled).mockReturnValue(false)
    vi.mocked(ruby.version).mockResolvedValue('3.1.1')
    vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
    vi.mocked(http.fetch).mockResolvedValue({status: 200} as any)

    vi.mocked(cliKitStore).mockReturnValue({
      setSession: vi.fn(),
      getSession: vi.fn(),
      removeSession: vi.fn(),
      getAppInfo: vi.fn(),
    } as any)
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

  it.each([
    ['node', 'package.json'],
    ['ruby', 'Gemfile'],
    ['php', 'composer.json'],
  ])('sends the expected data to Monorail when the project is %s', async (projectType, file) => {
    await inProjectWithFile(file, async (args) => {
      // Given
      const command = 'app info'
      start({command, args, currentTime: currentDate.getTime() - 100})

      // When
      await reportEvent()

      // Then
      const version = await constants.versions.cliKit()
      const expectedBody = {
        schema_id: 'app_cli3_command/1.0',
        payload: {
          project_type: projectType,
          command,
          args: args.join(' '),
          time_start: 1643709599900,
          time_end: 1643709600000,
          total_time: 100,
          success: true,
          uname: 'darwin arm64',
          cli_version: version,
          ruby_version: '3.1.1',
          node_version: process.version.replace('v', ''),
          is_employee: false,
          api_key: undefined,
          partner_id: undefined,
        },
      }
      expect(http.fetch).toHaveBeenCalledWith(expectedURL, {
        method: 'POST',
        body: JSON.stringify(expectedBody),
        headers: expectedHeaders,
      })
    })
  })

  it('sends the expected data to Monorail with cached app info', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const command = 'app dev'
      vi.mocked(cliKitStore().getAppInfo).mockReturnValueOnce({
        appId: 'key1',
        orgId: '1',
        storeFqdn: 'domain1',
        directory: '/cached',
      })
      start({command, args, currentTime: currentDate.getTime() - 100})

      // When
      await reportEvent()

      // Then
      const version = await constants.versions.cliKit()
      const expectedBody = {
        schema_id: 'app_cli3_command/1.0',
        payload: {
          project_type: 'node',
          command,
          args: args.join(' '),
          time_start: 1643709599900,
          time_end: 1643709600000,
          total_time: 100,
          success: true,
          uname: 'darwin arm64',
          cli_version: version,
          ruby_version: '3.1.1',
          node_version: process.version.replace('v', ''),
          is_employee: false,
          api_key: 'key1',
          partner_id: 1,
        },
      }
      expect(http.fetch).toHaveBeenCalledWith(expectedURL, {
        method: 'POST',
        body: JSON.stringify(expectedBody),
        headers: expectedHeaders,
      })
    })
  })

  it('sends the expected data to Monorail when there is an error message', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const command = 'app dev'
      start({command, args, currentTime: currentDate.getTime() - 100})

      // When
      await reportEvent({errorMessage: 'Permission denied'})

      // Then
      const version = await constants.versions.cliKit()
      const expectedBody = {
        schema_id: 'app_cli3_command/1.0',
        payload: {
          project_type: 'node',
          command,
          args: args.join(' '),
          time_start: 1643709599900,
          time_end: 1643709600000,
          total_time: 100,
          success: false,
          error_message: 'Permission denied',
          uname: 'darwin arm64',
          cli_version: version,
          ruby_version: '3.1.1',
          node_version: process.version.replace('v', ''),
          is_employee: false,
          api_key: undefined,
          partner_id: undefined,
        },
      }
      expect(http.fetch).toHaveBeenCalledWith(expectedURL, {
        method: 'POST',
        body: JSON.stringify(expectedBody),
        headers: expectedHeaders,
      })
    })
  })

  it('does nothing when analytics are disabled', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      vi.mocked(environment.local.analyticsDisabled).mockReturnValueOnce(true)
      const command = 'app dev'
      start({command, args, currentTime: currentDate.getTime() - 100})

      // When
      await reportEvent()

      // Then
      expect(http.fetch).not.toHaveBeenCalled()
    })
  })

  it('shows an error if the Monorail request fails', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const command = 'app dev'
      vi.mocked(http.fetch).mockResolvedValueOnce({status: 500, statusText: 'Monorail is down'} as any)
      const outputMock = mockAndCaptureOutput()
      start({command, args})

      // When
      await reportEvent()

      // Then
      expect(outputMock.debug()).toMatch('Failed to report usage analytics: Monorail is down')
    })
  })

  it('shows an error if something else fails', async () => {
    await inProjectWithFile('package.json', async (args) => {
      // Given
      const command = 'app dev'
      vi.mocked(os.platformAndArch).mockImplementationOnce(() => {
        throw new Error('Boom!')
      })
      const outputMock = mockAndCaptureOutput()
      start({command, args})

      // When
      await reportEvent()

      // Then
      expect(outputMock.debug()).toMatch('Failed to report usage analytics: Boom!')
    })
  })
})
