import {InstantaneousMetricReader} from '../../export/InstantaneousMetricReader.js'
import {OTLPMetricExporter, OTLPMetricExporterOptions} from '@opentelemetry/exporter-metrics-otlp-http'
import {Resource} from '@opentelemetry/resources'
import {AggregationTemporality, ConsoleMetricExporter, MeterProvider} from '@opentelemetry/sdk-metrics'
import {SemanticResourceAttributes} from '@opentelemetry/semantic-conventions'

export type Environment = 'production' | 'staging' | 'local'

interface DefaultMeterProviderOptions {
  serviceName: string
  env: string
  throttleLimit: number
  useXhr: boolean
  // CLI addition
  otelEndpoint: string
}

export class DefaultMeterProvider extends MeterProvider {
  constructor({serviceName, env, throttleLimit, useXhr, otelEndpoint}: DefaultMeterProviderOptions) {
    super({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
    })

    const opts: OTLPMetricExporterOptions = {
      // url: OTEL_ENDPOINTS[env as Environment] || OTEL_ENDPOINTS.local,
      // CLI addition
      url: otelEndpoint,
      temporalityPreference: AggregationTemporality.DELTA,
    }

    if (useXhr) {
      opts.headers = {}
    }

    const exporter = new OTLPMetricExporter(opts)

    this.addMetricReader(
      new InstantaneousMetricReader({
        exporter,
        throttleLimit,
      }),
    )

    // Add a console exporter to see what we are sending in dev environments
    if (env === 'dev') {
      this.addMetricReader(
        new InstantaneousMetricReader({
          exporter: new ConsoleMetricExporter(),
          throttleLimit,
        }),
      )
    }
  }
}
