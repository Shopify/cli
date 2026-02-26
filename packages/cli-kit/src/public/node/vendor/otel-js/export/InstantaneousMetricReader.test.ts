import {InstantaneousMetricReader} from './InstantaneousMetricReader.js'
import {ExportResultCode} from '@opentelemetry/core'
import type {PushMetricExporter, ResourceMetrics} from '@opentelemetry/sdk-metrics'
import {MeterProvider} from '@opentelemetry/sdk-metrics'
import {describe, expect, test, vi} from 'vitest'
import {diag} from '@opentelemetry/api'

vi.mock('@opentelemetry/api')

function createMockExporter(resultCode: ExportResultCode, error?: Error): PushMetricExporter {
  return {
    export: vi.fn((_metrics: ResourceMetrics, callback: (result: {code: ExportResultCode; error?: Error}) => void) => {
      callback({code: resultCode, error})
    }),
    forceFlush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as PushMetricExporter
}

function createReaderWithProvider(exporter: PushMetricExporter): {
  reader: InstantaneousMetricReader
  provider: MeterProvider
} {
  const reader = new InstantaneousMetricReader({exporter, throttleLimit: 0})
  const provider = new MeterProvider()
  provider.addMetricReader(reader)
  return {reader, provider}
}

describe('InstantaneousMetricReader', () => {
  test('logs errors when metrics collection fails', async () => {
    const exporter = createMockExporter(ExportResultCode.SUCCESS)
    const {reader, provider} = createReaderWithProvider(exporter)

    const collectionError = new Error('Collection failed')
    vi.spyOn(reader as any, 'collect').mockResolvedValue({
      resourceMetrics: {resource: {}, scopeMetrics: []},
      errors: [collectionError],
    })

    await expect(reader.forceFlush()).resolves.toBeUndefined()
    expect(diag.error).toHaveBeenCalledWith('InstantaneousMetricReader: metrics collection errors', collectionError)
    await provider.shutdown()
  })

  test('resolves on successful export', async () => {
    const exporter = createMockExporter(ExportResultCode.SUCCESS)
    const {reader, provider} = createReaderWithProvider(exporter)

    await expect(reader.forceFlush()).resolves.toBeUndefined()
    expect(diag.error).not.toHaveBeenCalled()
    await provider.shutdown()
  })

  test('resolves without rejecting on export failure', async () => {
    const err = new Error('Export failed with retryable status')
    const exporter = createMockExporter(ExportResultCode.FAILED, err)
    const {reader, provider} = createReaderWithProvider(exporter)

    await expect(reader.forceFlush()).resolves.toBeUndefined()
    expect(diag.error).toHaveBeenCalledWith('InstantaneousMetricReader: metrics export failed', err)
    await provider.shutdown()
  })

  test('resolves without rejecting when export error is undefined', async () => {
    const exporter = createMockExporter(ExportResultCode.FAILED)
    const {reader, provider} = createReaderWithProvider(exporter)

    await expect(reader.forceFlush()).resolves.toBeUndefined()
    expect(diag.error).toHaveBeenCalledWith('InstantaneousMetricReader: metrics export failed', undefined)
    await provider.shutdown()
  })
})
