import {throttle} from '../utils/throttle.js'
import {MetricReader} from '@opentelemetry/sdk-metrics'
import {ExportResultCode} from '@opentelemetry/core'
import {diag} from '@opentelemetry/api'
import type {PushMetricExporter} from '@opentelemetry/sdk-metrics'

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

    this.onForceFlush = throttle(this.onForceFlush, throttleLimit)
  }

  protected async onForceFlush(): Promise<void> {
    const {resourceMetrics, errors} = await this.collect({})

    if (errors.length > 0) {
      diag.error('InstantaneousMetricReader: metrics collection errors', ...errors)
    }

    return new Promise((resolve) => {
      this._exporter.export(resourceMetrics, (result) => {
        if (result.code !== ExportResultCode.SUCCESS) {
          diag.error('InstantaneousMetricReader: metrics export failed', result.error)
        }
        resolve()
      })
    })
  }

  protected async onShutdown(): Promise<void> {
    await this._exporter.shutdown()
  }
}
