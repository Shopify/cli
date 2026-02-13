import {InstantaneousMetricReader} from './InstantaneousMetricReader.js'
import {ExportResultCode} from '@opentelemetry/core'
import type {PushMetricExporter, ResourceMetrics} from '@opentelemetry/sdk-metrics'
import {MeterProvider} from '@opentelemetry/sdk-metrics'
import {describe, expect, test, vi} from 'vitest'

function createMockExporter(resultCode: ExportResultCode, error?: Error): PushMetricExporter {
  return {
    export: vi.fn((_metrics: ResourceMetrics, callback: (result: {code: ExportResultCode; error?: Error}) => void) => {
      callback({code: resultCode, error})
    }),
    forceFlush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as PushMetricExporter
}

function createReaderWithProvider(exporter: PushMetricExporter): {reader: InstantaneousMetricReader; provider: MeterProvider} {
  const reader = new InstantaneousMetricReader({exporter, throttleLimit: 0})
  const provider = new MeterProvider()
  provider.addMetricReader(reader)
  return {reader, provider}
}

describe('InstantaneousMetricReader', () => {
  test('resolves on successful export', async () => {
    const exporter = createMockExporter(ExportResultCode.SUCCESS)
    const {reader, provider} = createReaderWithProvider(exporter)

    await expect(reader.forceFlush()).resolves.toBeUndefined()
    await provider.shutdown()
  })

  test('resolves without rejecting on export failure', async () => {
    const exporter = createMockExporter(ExportResultCode.FAILED, new Error('Export failed with retryable status'))
    const {reader, provider} = createReaderWithProvider(exporter)

    await expect(reader.forceFlush()).resolves.toBeUndefined()
    await provider.shutdown()
  })

  test('resolves without rejecting when export error is undefined', async () => {
    const exporter = createMockExporter(ExportResultCode.FAILED)
    const {reader, provider} = createReaderWithProvider(exporter)

    await expect(reader.forceFlush()).resolves.toBeUndefined()
    await provider.shutdown()
  })
})
