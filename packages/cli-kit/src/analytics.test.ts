/* eslint-disable @typescript-eslint/naming-convention */
import {reportEvent} from './analytics.js'
import * as environment from './environment.js'
import * as http from './http.js'
import * as os from './os.js'
import * as ruby from './ruby.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {it, expect, vi, beforeEach, afterAll} from 'vitest'

const currentDate = new Date(Date.UTC(2022, 1, 1, 10, 0, 0))
const expectedURL = 'https://monorail-edge.shopifysvc.com/v1/produce'
const expectedHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Monorail-Edge-Event-Created-At-Ms': '1643709600000',
  'X-Monorail-Edge-Event-Sent-At-Ms': '1643709600000',
}

beforeEach(() => {
  vi.setSystemTime(currentDate)
  vi.mock('./environment')
  vi.mock('./ruby')
  vi.mock('./os')
  vi.mock('./store')
  vi.mock('./http')
  vi.mock('./version')
  vi.mock('./constants.js', () => {
    return {versions: {cliVersion: () => '3.0.0'}}
  })
  vi.mocked(environment.local.isShopify).mockResolvedValue(false)
  vi.mocked(environment.local.isDebug).mockReturnValue(false)
  vi.mocked(environment.local.analyticsDisabled).mockReturnValue(false)
  vi.mocked(ruby.version).mockResolvedValue('3.1.1')
  vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
  vi.mocked(http.fetch).mockResolvedValue({status: 200} as any)
})

afterAll(() => {
  vi.useRealTimers()
})

it('makes an API call to Monorail with the expected payload and headers', async () => {
  // Given
  const command = 'app info'
  const args: string[] = []

  // When
  await reportEvent(command, args)

  // Then
  const expectedBody = {
    schema_id: 'app_cli3_command/1.0',
    payload: {
      project_type: undefined,
      command,
      args: '',
      time_start: 1643709600000,
      time_end: 1643709600000,
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
  expect(http.fetch).toHaveBeenCalledWith(expectedURL, {
    method: 'POST',
    body: JSON.stringify(expectedBody),
    headers: expectedHeaders,
  })
})

// it('makes an API call to Monorail with the expected payload with cached app info', async () => {
//   // Given
//   const command = 'app dev'
//   const args = ['--path', 'fixtures/app']
//   vi.mocked(store.getAppInfo).mockReturnValueOnce({
//     appId: 'key1',
//     orgId: '1',
//     storeFqdn: 'domain1',
//     directory: '/cached',
//   })

//   // When
//   await reportEvent(command, args)

//   // Then
//   const expectedBody = {
//     schema_id: 'app_cli3_command/1.0',
//     payload: {
//       project_type: undefined,
//       command,
//       args: '--path fixtures/app',
//       time_start: currentDate.getTime(),
//       time_end: currentDate.getTime(),
//       total_time: 0,
//       success: true,
//       uname: 'darwin arm64',
//       cli_version: '3.0.0',
//       ruby_version: '3.1.1',
//       node_version: process.version.replace('v', ''),
//       is_employee: false,
//       api_key: 'key1',
//       partner_id: 1,
//     },
//   }
//   expect(http.fetch).toHaveBeenCalledWith(expectedURL, {
//     method: 'POST',
//     body: JSON.stringify(expectedBody),
//     headers: expectedHeaders,
//   })
// })

it('does nothing in Debug mode', async () => {
  // Given
  vi.mocked(environment.local.isDebug).mockReturnValue(true)
  const command = 'app dev'
  const args: string[] = []

  // When
  await reportEvent(command, args)

  // Then
  expect(http.fetch).not.toHaveBeenCalled()
})

it('does nothing when analytics are disabled', async () => {
  // Given
  vi.mocked(environment.local.analyticsDisabled).mockReturnValueOnce(true)
  const command = 'app dev'
  const args: string[] = []

  // When
  await reportEvent(command, args)

  // Then
  expect(http.fetch).not.toHaveBeenCalled()
})

it('shows an error if the Monorail request fails', async () => {
  // Given
  const command = 'app dev'
  const args: string[] = []
  vi.mocked(http.fetch).mockResolvedValueOnce({status: 500, statusText: 'Monorail is down'} as any)
  const outputMock = mockAndCaptureOutput()

  // When
  await reportEvent(command, args)

  // Then
  expect(outputMock.debug()).toMatch('Failed to report usage analytics: Monorail is down')
})

it('shows an error if something else fails', async () => {
  // Given
  const command = 'app dev'
  const args: string[] = []
  vi.mocked(os.platformAndArch).mockImplementationOnce(() => {
    throw new Error('Boom!')
  })
  const outputMock = mockAndCaptureOutput()

  // When
  await reportEvent(command, args)

  // Then
  expect(outputMock.debug()).toMatch('Failed to report usage analytics: Boom!')
})
