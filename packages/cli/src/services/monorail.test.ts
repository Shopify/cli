/* eslint-disable @typescript-eslint/naming-convention */
import {buildPayload} from './monorail'
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
  expect(got).toEqual({
    projectType: 'node',
    command,
    args: '',
    timeStart: currentDate.getTime(),
    timeEnd: currentDate.getTime(),
    totalTime: 0,
    success: true,
    uname: 'darwin arm64',
    cliVersion: '3.0.0',
    rubyVersion: '3.1.1',
    nodeVersion: process.version.replace('v', ''),
    isEmployee: false,
    api_key: undefined,
    partner_id: undefined,
  })
})

it('returs the expected payload with cached app info', async () => {
  // Given
  const command = 'app dev'
  const args = ['--path', 'fixtures/app']
  vi.mocked(store.getAppInfo).mockReturnValue({appId: 'key1', orgId: '1', storeFqdn: 'domain1', directory: '/cached'})

  // When
  const got = await buildPayload(command, args)

  // Then
  expect(got).toEqual({
    projectType: 'node',
    command,
    args: '--path fixtures/app',
    timeStart: currentDate.getTime(),
    timeEnd: currentDate.getTime(),
    totalTime: 0,
    success: true,
    uname: 'darwin arm64',
    cliVersion: '3.0.0',
    rubyVersion: '3.1.1',
    nodeVersion: process.version.replace('v', ''),
    isEmployee: false,
    api_key: 'key1',
    partner_id: '1',
  })
})
