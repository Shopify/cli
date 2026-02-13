import {DefaultMeterProvider} from './DefaultMeterProvider.js'
import {BaseOtelService} from '../BaseOtelService/BaseOtelService.js'
import {diag, DiagConsoleLogger, DiagLogLevel} from '@opentelemetry/api'

import type {BaseOtelServiceOptions} from '../BaseOtelService/BaseOtelService.js'

export interface DefaultOtelServiceOptions extends BaseOtelServiceOptions {
  /**
   * What environment is being deployed (production, staging)
   */
  env?: string
  /**
   * How much the export should be throttled in milliseconds.
   */
  throttleLimit?: number
  /**
   * Determines whether to send metrics via XHR or beacon. Defaults to false.
   */
  useXhr?: boolean

  // CLI addition
  otelEndpoint: string
}

export class DefaultOtelService extends BaseOtelService {
  /**
   * Bootstraps an Otel exporter which can send Otel metrics to a dedicated Shopify supported collector endpoint.
   */
  constructor({
    throttleLimit = 5000,
    env = 'local',
    serviceName,
    prefixMetric = false,
    metrics = {},
    onRecord,
    meterProvider,
    useXhr = false,
    // CLI addition
    otelEndpoint,
  }: DefaultOtelServiceOptions) {
    diag.setLogger(
      new DiagConsoleLogger(),
      ['production', 'staging'].includes(env) ? DiagLogLevel.ERROR : DiagLogLevel.INFO,
    )

    super({
      serviceName,
      meterProvider:
        meterProvider ??
        new DefaultMeterProvider({
          serviceName,
          env,
          throttleLimit,
          useXhr,
          // CLI addition
          otelEndpoint,
        }),
      prefixMetric,
      metrics,
      onRecord,
    })
  }

  override shutdown(): Promise<void> {
    diag.disable()
    return super.shutdown()
  }
}
