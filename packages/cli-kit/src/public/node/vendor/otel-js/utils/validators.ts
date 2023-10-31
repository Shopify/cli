import {diag} from '@opentelemetry/api'

const validMetricRegex = new RegExp('[^a-zA-Z_][^a-zA-Z0-9_]*')

export function isValidMetricName(value: string): boolean {
  if (validMetricRegex.test(value)) {
    diag.warn(
      `Metric name ${value} contains invalid characters and will be dropped.
    Service Names and metric names must conform to the following regex %c[a-zA-Z_][a-zA-Z0-9_]*`,
      'color:red',
    )
    return false
  }

  return true
}
