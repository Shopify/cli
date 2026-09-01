import {isValidMetricName} from './validators.js'
import {diag} from '@opentelemetry/api'
import {describe, expect, test, vi} from 'vitest'

describe('isValidMetricName', () => {
  test('returns true for valid metric names', () => {
    expect(isValidMetricName('valid_metric_name')).toBe(true)
    expect(isValidMetricName('metric')).toBe(true)
    expect(isValidMetricName('_metric')).toBe(true)
    expect(isValidMetricName('METRIC_NAME')).toBe(true)
  })

  test('returns false and logs warning for invalid metric names', () => {
    const diagSpy = vi.spyOn(diag, 'warn').mockImplementation(() => {})

    expect(isValidMetricName('invalid-metric')).toBe(false)
    expect(isValidMetricName('123metric')).toBe(false)
    expect(isValidMetricName('metric.name')).toBe(false)
    expect(isValidMetricName('metric@name')).toBe(false)
    expect(isValidMetricName('metric name')).toBe(false)

    expect(diagSpy).toHaveBeenCalled()
  })
})
