import type {
  Counter,
  Histogram,
  MeterProvider,
  MetricAttributes,
  MetricOptions,
  UpDownCounter,
} from '@opentelemetry/api'
import type {ViewOptions} from '@opentelemetry/sdk-metrics'

export type CustomMetricLabels<
  TLabels extends {[key in TKeys]: MetricAttributes},
  TKeys extends string = keyof TLabels & string,
> = {
  [P in TKeys]: TLabels[P] extends MetricAttributes ? TLabels[P] : never
}

export type MetricRecording<TAttributes extends MetricAttributes = any> = [value: number, labels?: TAttributes]

export type RecordMetricFunction<TAttributes extends MetricAttributes = any> = (
  ...args: MetricRecording<TAttributes>
) => void

export type OnRecordCallback<TAttributes extends MetricAttributes = any> = (
  metricName: string,
  ...args: MetricRecording<TAttributes>
) => MetricRecording<TAttributes> | void

export type MetricInstrument = Histogram | Counter | UpDownCounter

export enum MetricInstrumentType {
  Histogram = 'Histogram',
  Counter = 'Counter',
  UpDownCounter = 'UpDownCounter',
}

export type MetricDescriptor = MetricOptions &
  (
    | {
        type: MetricInstrumentType.Histogram
        /**
         * Boundaries are required for Histograms.
         */
        boundaries: number[]
      }
    | {
        type: MetricInstrumentType.Counter | MetricInstrumentType.UpDownCounter
      }
  )

export interface MetricsConfig {
  [key: string]: MetricDescriptor
}

export interface OtelService {
  readonly serviceName: string

  getMeterProvider(): MeterProvider

  addView(viewOptions: ViewOptions): void

  record<TAttributes extends MetricAttributes = any>(...args: Parameters<OnRecordCallback<TAttributes>>): void

  /**
   * `onRecord` callback is called when a metric is recorded.
   * Returns a function to unsubscribe.
   */
  addOnRecord(onRecord: OnRecordCallback): () => void

  removeOnRecord(onRecord: OnRecordCallback): void

  registerMetric(metricName: string, options: MetricDescriptor): void

  register(metrics: MetricsConfig): void

  shutdown(): Promise<void>
}
