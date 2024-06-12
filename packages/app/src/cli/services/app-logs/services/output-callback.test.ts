import {DEV_OUTPUT_CALLBACKS} from './output-callbacks.js'
import {writeAppLogsToFile} from '../write-app-logs.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {createLogsDir} from '@shopify/cli-kit/node/logs'
import * as components from '@shopify/cli-kit/node/ui/components'
import {Writable} from 'stream'

const ONE_MILLION = 1000000

vi.mock('../write-app-logs.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/logs')

describe('DEV_OUTPUT_CALLBACKS', () => {
  describe('appLogsDevOutput', () => {
    let stdout: Writable
    let log: any
    let logFailure: any
    let apiKey: string

    beforeEach(() => {
      stdout = {write: vi.fn()} as unknown as Writable
      log = {
        source: 'source',
        payload: JSON.stringify({
          fuel_consumed: 2 * ONE_MILLION,
          error_type: 'SomeError',
          logs: ['log1', 'log2'],
        }),
        event_type: 'function_run',
        shop_id: 123,
        api_client_id: 456,
        cursor: 'cursor',
        log_timestamp: 'timestamp',
      }
      apiKey = 'API_KEY'

      vi.mocked(createLogsDir).mockResolvedValue()
    })

    test('writes success message to stdout', async () => {
      // Given
      log.status = 'success'
      vi.mocked(writeAppLogsToFile)
      vi.spyOn(components, 'useConcurrentOutputContext')

      // When
      await DEV_OUTPUT_CALLBACKS.onFunctionRunCallback({stdout, log, apiKey})

      // Then
      expect(createLogsDir).toHaveBeenCalledWith(apiKey)
      expect(stdout.write).toHaveBeenCalledWith('Function executed successfully using 2.0000M instructions.')
      expect(stdout.write).toHaveBeenCalledWith(['log1', 'log2'])
      expect(writeAppLogsToFile).toHaveBeenCalledWith({
        appLog: {
          event_type: 'function_run',
          payload: '{"fuel_consumed":2000000,"error_type":"SomeError","logs":["log1","log2"]}',
          source: 'source',
          status: 'success',
          shop_id: 123,
          api_client_id: 456,
          cursor: 'cursor',
          log_timestamp: 'timestamp',
        },
        apiKey: 'API_KEY',
        stdout,
      })
      expect(components.useConcurrentOutputContext).toHaveBeenCalledWith({outputPrefix: 'source'}, expect.any(Function))
    })

    test('writes error message to stdout', async () => {
      // Given
      log.status = 'failure'
      vi.mocked(writeAppLogsToFile)
      vi.spyOn(components, 'useConcurrentOutputContext')

      // When
      await DEV_OUTPUT_CALLBACKS.onFunctionRunCallback({stdout, log, apiKey})

      // Then
      expect(createLogsDir).toHaveBeenCalledWith(apiKey)
      expect(stdout.write).toHaveBeenCalledWith(`❌ Function failed to execute with error: SomeError`)
      expect(stdout.write).toHaveBeenCalledWith(['log1', 'log2'])
      expect(writeAppLogsToFile).toHaveBeenCalledWith({
        appLog: {
          event_type: 'function_run',
          payload: '{"fuel_consumed":2000000,"error_type":"SomeError","logs":["log1","log2"]}',
          source: 'source',
          status: 'failure',
          shop_id: 123,
          api_client_id: 456,
          cursor: 'cursor',
          log_timestamp: 'timestamp',
        },
        apiKey: 'API_KEY',
        stdout,
      })
      expect(components.useConcurrentOutputContext).toHaveBeenCalledWith({outputPrefix: 'source'}, expect.any(Function))
    })

    test('writes payload to stdout', async () => {
      // Given
      log.event_type = 'other'
      log.status = 'success'
      vi.mocked(writeAppLogsToFile)
      vi.spyOn(components, 'useConcurrentOutputContext')

      // When
      await DEV_OUTPUT_CALLBACKS.onFunctionRunCallback({stdout, log, apiKey})

      // Then
      expect(createLogsDir).toHaveBeenCalledWith(apiKey)
      expect(stdout.write).toHaveBeenCalledWith(
        '{"fuel_consumed":2000000,"error_type":"SomeError","logs":["log1","log2"]}',
      )
      expect(writeAppLogsToFile).toHaveBeenCalledWith({
        appLog: {
          event_type: 'other',
          payload: '{"fuel_consumed":2000000,"error_type":"SomeError","logs":["log1","log2"]}',
          source: 'source',
          shop_id: 123,
          api_client_id: 456,
          cursor: 'cursor',
          status: 'success',
          log_timestamp: 'timestamp',
        },
        apiKey: 'API_KEY',
        stdout,
      })
      expect(components.useConcurrentOutputContext).toHaveBeenCalledWith({outputPrefix: 'source'}, expect.any(Function))
    })
  })

  describe('appLogsDevErrorOutput', () => {
    let stdout: Writable
    let log: any
    let logFailure: any
    let apiKey: string

    beforeEach(() => {
      stdout = {write: vi.fn()} as unknown as Writable
      log = {
        source: 'source',
        payload: JSON.stringify({
          fuel_consumed: 2 * ONE_MILLION,
          error_type: 'SomeError',
          logs: ['log1', 'log2'],
        }),
        event_type: 'function_run',
        shop_id: 123,
        api_client_id: 456,
        cursor: 'cursor',
        log_timestamp: 'timestamp',
      }
      apiKey = 'API_KEY'

      vi.mocked(createLogsDir).mockResolvedValue()
    })
    test('writes error messages to stdout', () => {
      // When
      DEV_OUTPUT_CALLBACKS.onErrorCallback({stdout})
      // Then
      expect(stdout.write).toHaveBeenCalledWith('Error while retrieving app logs.')
      expect(stdout.write).toHaveBeenCalledWith('App log streaming is no longer available in this `dev` session.')
    })
  })
})
