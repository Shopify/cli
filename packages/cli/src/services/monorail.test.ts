/* eslint-disable @typescript-eslint/naming-convention */
import {buildHeaders, buildPayload} from './monorail'
import {it, expect, vi, beforeEach, afterAll} from 'vitest'
import {environment, os, ruby, store} from '@shopify/cli-kit'

const currentDate = new Date(2022, 1, 1, 10)

beforeEach(() => {
  vi.setSystemTime(currentDate)
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      environment: {
        local: {
          isShopify: vi.fn(),
        },
      },
      ruby: {
        version: vi.fn(),
      },
      os: {
        platformAndArch: vi.fn(),
      },
      store: {
        getAppInfo: vi.fn(),
      },
    }
  })
  vi.mock('../../package.json', () => {
    return {
      version: '3.0.0',
    }
  })
  vi.mocked(environment.local.isShopify).mockResolvedValue(false)
  vi.mocked(ruby.version).mockResolvedValue('3.1.1')
  vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
})

afterAll(() => {
  vi.useRealTimers()
})

it('returs the expected payload', async () => {
  // Given
  const command = 'app info'
  const args: string[] = []

  // When
  const got = await buildPayload(command, args)

  // Then
  const expectedResult = {
    schema_id: 'app_cli3_command/1.0',
    payload: {
      project_type: 'node',
      command,
      args: '',
      time_start: 1643706000000,
      time_end: 1643706000000,
      total_time: 0,
      success: true,
      uname: 'darwin arm64',
      cli_version: '3.0.0',
      ruby_version: '3.1.1',
      node_version: process.version.replace('v', ''),
      is_employee: false,
      api_key: undefined,
      partner_id: undefined,
    },
  }
  expect(got).toEqual(expectedResult)
})

it('returs the expected payload with cached app info', async () => {
  // Given
  const command = 'app dev'
  const args = ['--path', 'fixtures/app']
  vi.mocked(store.getAppInfo).mockReturnValue({appId: 'key1', orgId: '1', storeFqdn: 'domain1', directory: '/cached'})

  // When
  const got = await buildPayload(command, args)

  // Then
  const expectedResult = {
    schema_id: 'app_cli3_command/1.0',
    payload: {
      project_type: 'node',
      command,
      args: '--path fixtures/app',
      time_start: currentDate.getTime(),
      time_end: currentDate.getTime(),
      total_time: 0,
      success: true,
      uname: 'darwin arm64',
      cli_version: '3.0.0',
      ruby_version: '3.1.1',
      node_version: process.version.replace('v', ''),
      is_employee: false,
      api_key: 'key1',
      partner_id: '1',
    },
  }
  expect(got).toEqual(expectedResult)
})

it('returs the expected headers', async () => {
  // When
  const got = await buildHeaders()

  // Then
  expect(got).toEqual({
    'Content-Type': 'application/json; charset=utf-8',
    'X-Monorail-Edge-Event-Created-At-Ms': '1643706000000',
    'X-Monorail-Edge-Event-Sent-At-Ms': '1643706000000',
  })
})
