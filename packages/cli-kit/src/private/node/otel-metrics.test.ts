import {recordMetrics} from './otel-metrics.js'
import {mockAndCaptureOutput} from '../../public/node/testing/output.js'
import {describe, expect, test, vi} from 'vitest'

describe('otel-metrics', () => {
  test('outputs debug information when deactivated', async () => {
    const outputMock = mockAndCaptureOutput()

    await recordMetrics(
      {
        skipMetricAnalytics: true,
        cliVersion: '0.0.0-nightly.1234567890',
        owningPlugin: '@shopify/app',
        command: 'app dev',
        exitMode: 'ok',
      },
      {
        active: 10,
        network: 20,
        prompt: 30,
      },
    )

    expect(outputMock.output()).toMatchSnapshot()
  })

  test('logs metrics when activated', async () => {
    const mockOtelRecorder = vi.fn()
    const mockForceFlush = vi.fn().mockResolvedValue(undefined)
    const mockOtelCreator = vi.fn()
    mockOtelCreator.mockReturnValue({
      type: 'otel',
      otel: {
        record: mockOtelRecorder,
        getMeterProvider: () => ({forceFlush: mockForceFlush}),
      },
    })

    await recordMetrics(
      {
        skipMetricAnalytics: false,
        cliVersion: '3.49.1-pre.0',
        owningPlugin: '@shopify/app',
        command: 'app dev',
        exitMode: 'ok',
      },
      {
        active: 10,
        network: 20,
        prompt: 30,
      },
      mockOtelCreator,
    )

    expect(mockOtelCreator).toHaveBeenCalledOnce()
    expect(mockOtelRecorder.mock.calls).toMatchSnapshot()
    expect(mockForceFlush).toHaveBeenCalledOnce()
  })

  test('waits for metrics to flush', async () => {
    let resolveFlush: () => void = () => {}
    const flush = new Promise<void>((resolve) => {
      resolveFlush = resolve
    })
    const recorderFactory = vi.fn().mockReturnValue({
      type: 'otel',
      otel: {
        record: vi.fn(),
        getMeterProvider: () => ({forceFlush: () => flush}),
      },
    })

    let metricsRecorded = false
    const recording = recordMetrics(
      {
        skipMetricAnalytics: false,
        cliVersion: '4.6.0',
        owningPlugin: '@shopify/app',
        command: 'app dev',
        exitMode: 'ok',
      },
      {active: 10, network: 20, prompt: 30},
      recorderFactory,
    ).then(() => {
      metricsRecorded = true
    })

    await vi.waitFor(() => expect(recorderFactory).toHaveBeenCalledOnce())
    expect(metricsRecorded).toBe(false)

    resolveFlush()
    await recording
    expect(metricsRecorded).toBe(true)
  })
})
