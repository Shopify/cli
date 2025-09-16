import type {MetricAttributes} from '@opentelemetry/api'
import type {MeterProvider, ViewOptions} from '@opentelemetry/sdk-metrics'
import {ExplicitBucketHistogramAggregation, View} from '@opentelemetry/sdk-metrics'

import type {
  MetricDescriptor,
  MetricRecording,
  MetricsConfig,
  OnRecordCallback,
  OtelService,
  RecordMetricFunction,
} from '../types.js'
import {MetricInstrumentType} from '../types.js'
import {isValidMetricName} from '../../utils/validators.js'

const instrumentationScope = 'opentelemetry-js-shopify-web'

export interface BaseOtelServiceOptions {
  /**
   * Service name is a unique name for an application/service.
   */
  serviceName: string

  /**
   * If this is set to true then the service name is prefixed to every metric.
   */
  prefixMetric?: boolean

  /**
   * Metrics to register on startup.
   */
  metrics?: MetricsConfig

  /**
   * Called when a metric is recorded. `addOnRecord` can also be used to add
   * listeners anytime.
   */
  onRecord?: OnRecordCallback

  /**
   * Override the default meter provider.
   */
  meterProvider?: MeterProvider
}

export class BaseOtelService implements OtelService {
  readonly serviceName: string
  readonly prefixMetric: boolean

  protected readonly meterProvider: MeterProvider
  protected readonly metrics: Map<string, RecordMetricFunction> = new Map()
  protected readonly recordListeners = new Set<OnRecordCallback>()

  /**
   * Bootstraps an Otel exporter which can send Otel metrics to a dedicated Shopify supported collector endpoint.
   */
  constructor({serviceName, prefixMetric = false, metrics = {}, onRecord, meterProvider}: BaseOtelServiceOptions) {
    if (!serviceName) {
      throw new Error('Service name is required.')
    }
    this.serviceName = serviceName

    this.prefixMetric = prefixMetric
    if (onRecord) this.addOnRecord(onRecord)

    if (!meterProvider) {
      throw new Error('MeterProvider is required.')
    }
    this.meterProvider = meterProvider

    this.register(metrics)
  }

  getMeterProvider(): MeterProvider {
    return this.meterProvider
  }

  addView(viewOptions: ViewOptions) {
    // The API to register view is not yet exposed. We need to use the private
    // property to register a new view after the initial instantiation.
    ;(this.meterProvider as any)._sharedState?.viewRegistry?.addView?.(new View(viewOptions))
  }

  record(metricName: string, value: number, labels?: MetricAttributes): void {
    const recordMetric = this.metrics.get(metricName)
    if (!recordMetric) {
      throw new Error(
        `Service ${this.serviceName} has no metrics registered for name: ${metricName}. Can't record value for unknown metric.`,
      )
    }
    recordMetric(value, labels)
  }

  registerMetric(metricName: string, {type, ...options}: MetricDescriptor): void {
    if (this.metrics.has(metricName)) {
      return
    }
    const meter = this.meterProvider.getMeter(instrumentationScope)
    const name = this.prefixMetric ? `${this.serviceName}_${metricName}` : metricName

    if (!isValidMetricName(name)) {
      return
    }

    const createInstrument = () => {
      switch (type) {
        case MetricInstrumentType.Counter:
          return meter.createCounter(name, options)
        case MetricInstrumentType.UpDownCounter:
          return meter.createUpDownCounter(name, options)
        case MetricInstrumentType.Histogram: {
          if ('boundaries' in options) {
            this.addView({
              instrumentName: name,
              aggregation: new ExplicitBucketHistogramAggregation(options.boundaries, true),
            })
          }
          return meter.createHistogram(name, options)
        }
      }
    }

    // Lazy instantiate the instrument so we don't create it if we don't need to
    this.metrics.set(metricName, (firstValue: number, firstLabels?: MetricAttributes) => {
      const instrument = createInstrument()
      const record = (value: number, labels?: MetricAttributes) => {
        const [finalValue, finalLabels] = this.notifyRecordListeners(
          metricName,
          value,
          // ensures an new object is created so we don't mutate the original
          {...labels},
        )
        if ('record' in instrument) {
          instrument.record(finalValue, finalLabels)
        } else {
          instrument.add(finalValue, finalLabels)
        }
        // We flush metrics after every record - we do not await as we fire & forget.
        // Catch any export errors to prevent unhandled rejections from crashing the CLI
        void this.meterProvider.forceFlush({}).catch(() => {})
      }
      record(firstValue, firstLabels)
      this.metrics.set(metricName, record)
    })
  }

  register(metrics: MetricsConfig) {
    Object.entries(metrics).forEach(([metricName, options]) => {
      this.registerMetric(metricName, options)
    })
  }

  addOnRecord(onRecord: OnRecordCallback): () => void {
    this.recordListeners.add(onRecord)
    return () => {
      this.recordListeners.delete(onRecord)
    }
  }

  removeOnRecord(onRecord: OnRecordCallback): void {
    this.recordListeners.delete(onRecord)
  }

  shutdown(): Promise<void> {
    this.metrics.clear()
    this.recordListeners.clear()
    return this.meterProvider.shutdown()
  }

  protected notifyRecordListeners(metricName: string, initialValue: number, initialLabels: MetricAttributes) {
    return Array.from(this.recordListeners).reduce<MetricRecording>(
      (recordArgs, listener) => {
        return listener(metricName, ...recordArgs) || recordArgs
      },
      [initialValue, initialLabels],
    )
  }
}
