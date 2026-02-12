import type {PushMetricExporter} from '@opentelemetry/sdk-metrics'
import {MetricReader} from '@opentelemetry/sdk-metrics'
import {ExportResultCode} from '@opentelemetry/core'
import {diag} from '@opentelemetry/api'

import {throttle} from '../utils/throttle.js'

export interface InstantaneousMetricReaderOptions {
  /**
   * The backing exporter for the metric reader.
   */
  exporter: PushMetricExporter

  /**
   * How much the export should be throttled in milliseconds.
   */
  throttleLimit: number
}

export class InstantaneousMetricReader extends MetricReader {
  private readonly _exporter: PushMetricExporter

  constructor({exporter, throttleLimit}: InstantaneousMetricReaderOptions) {
    super({
      aggregationSelector: exporter.selectAggregation?.bind(exporter),
      aggregationTemporalitySelector: exporter.selectAggregationTemporality?.bind(exporter),
    })
    this._exporter = exporter

    this.onForceFlush = throttle(
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.onForceFlush,
      throttleLimit,
    )
  }

  protected async onForceFlush(): Promise<void> {
    const {resourceMetrics, errors} = await this.collect({})

    if (errors.length > 0) {
      diag.error('PeriodicExportingMetricReader: metrics collection errors', ...errors)
    }

    return new Promise((resolve, reject) => {
      this._exporter.export(resourceMetrics, (result) => {
        if (result.code === ExportResultCode.SUCCESS) {
          resolve()
        } else {
          reject(result.error ?? new Error(`InstantaneousMetricReader: metrics export failed (error ${result.error})`))
        }
      })
    })
  }

  protected async onShutdown(): Promise<void> {
    await this._exporter.shutdown()
  }
}
