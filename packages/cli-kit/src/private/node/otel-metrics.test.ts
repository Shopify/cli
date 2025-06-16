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
    const mockOtelCreator = vi.fn()
    mockOtelCreator.mockReturnValue({
      type: 'otel',
      otel: {
        record: mockOtelRecorder,
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
  })
})
