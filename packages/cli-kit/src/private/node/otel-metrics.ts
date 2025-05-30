import {MetricInstrumentType, OtelService} from '../../public/node/vendor/otel-js/service/types.js'
import {outputDebug} from '../../public/node/output.js'
import {
  DefaultOtelService,
  DefaultOtelServiceOptions,
} from '../../public/node/vendor/otel-js/service/DefaultOtelService/DefaultOtelService.js'
import {isUnitTest, opentelemetryDomain} from '../../public/node/context/local.js'
import {isSpinEnvironment} from '../../public/node/context/spin.js'
import {ValueType} from '@opentelemetry/api'

type MetricRecorder =
  | 'console'
  | {
      type: 'otel'
      otel: Pick<OtelService, 'record'>
    }

// this should be type, not interface
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Labels = {
  exit: string
  job: string
  cli_version: string
}

interface Timing {
  active: number
  network: number
  prompt: number
}

enum Name {
  Counter = 'cli_commands_total',
  Duration = 'cli_commands_duration_ms',
  Elapsed = 'cli_commands_wall_clock_elapsed_ms',
}

interface CreateMetricRecorderOptions {
  skipMetricAnalytics: boolean
  otelOptions: Omit<DefaultOtelServiceOptions, 'env' | 'otelEndpoint'>
}

interface RecordMetricsOptions {
  /** If true, don't log anything */
  skipMetricAnalytics: boolean
  /** The CLI version running the command */
  cliVersion: string
  /** The plug-in that owns the command */
  owningPlugin: string
  /** The command name, e.g. `app dev` */
  command: string
  /** The exit mode for the command */
  exitMode: string
}

/**
 * Record reliability metrics.
 */
export async function recordMetrics(
  options: RecordMetricsOptions,
  timing: Timing,
  recorderFactory: (options: CreateMetricRecorderOptions) => MetricRecorder = createMetricRecorder,
) {
  const recorder = recorderFactory({
    skipMetricAnalytics: options.skipMetricAnalytics,
    otelOptions: defaultOtelOptions(),
  })

  let regularisedCliVersion = options.cliVersion

  if (options.cliVersion.includes('nightly')) {
    regularisedCliVersion = 'nightly'
  } else if (options.cliVersion.includes('pre')) {
    regularisedCliVersion = 'pre'
  }
  const labels = {
    exit: options.exitMode,
    job: `${options.owningPlugin}::${options.command}`,
    cli_version: regularisedCliVersion,
  }

  recordCommandCounter(recorder, labels)
  recordCommandTiming(recorder, labels, timing)
}

/**
 * Get the default options for the OTEL service. These are the same across environments.
 */
function defaultOtelOptions(): Omit<DefaultOtelServiceOptions, 'env' | 'otelEndpoint'> {
  return {
    serviceName: 'shopify-cli',
    throttleLimit: 1000,
    prefixMetric: false,
    metrics: {
      [Name.Counter]: {
        type: MetricInstrumentType.Counter,
        description: 'Total number of CLI commands executed',
        valueType: ValueType.INT,
      },
      [Name.Duration]: {
        type: MetricInstrumentType.Histogram,
        description:
          'Total time spent in execution of CLI commands. Does not include time spent waiting for network, prompts, etc.',
        valueType: ValueType.INT,
        boundaries: [0, 100, 250, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000],
      },
      [Name.Elapsed]: {
        type: MetricInstrumentType.Histogram,
        description:
          'Total time elapsed from start to finish of CLI commands. Includes time spent waiting for network, prompts, etc.',
        valueType: ValueType.INT,
        boundaries: [0, 100, 250, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000],
      },
    },
  }
}

/**
 * Create the metric recorder for this command.
 *
 * If metric logging is disabled, or we are running in a unit test or Spin, we record to the console.
 *
 */
function createMetricRecorder(options: CreateMetricRecorderOptions): MetricRecorder {
  let recorder: MetricRecorder = 'console'
  if (!(options.skipMetricAnalytics || isUnitTest() || isSpinEnvironment())) {
    recorder = {
      type: 'otel',
      otel: globalOtelService(options),
    }
  }
  return recorder
}

let _otelService: OtelService | undefined

/**
 * OTEL service singleton.
 *
 * The service is a singleton as it uses a global diagnostic logger that assumes its the only one in the process.
 */
function globalOtelService(options: CreateMetricRecorderOptions): OtelService {
  if (!_otelService) {
    _otelService = new DefaultOtelService({
      ...options.otelOptions,
      env: undefined,
      otelEndpoint: `${opentelemetryDomain()}/v1/metrics`,
    })
  }
  return _otelService
}

/**
 * Log command counter metrics.
 */
function recordCommandCounter(recorder: MetricRecorder, labels: Labels) {
  if (recorder === 'console') {
    outputDebug(`[OTEL] record ${Name.Counter} counter ${JSON.stringify({labels}, null, 2)}`)
    return
  }
  recorder.otel.record(Name.Counter, 1, labels)
}

/**
 * Log command timing metrics.
 */
function recordCommandTiming(recorder: MetricRecorder, labels: Labels, timing: Timing) {
  if (recorder === 'console') {
    outputDebug(
      `[OTEL] record ${Name.Duration} histogram ${timing.active.toString()}ms ${JSON.stringify(
        {
          labels,
        },
        null,
        2,
      )}`,
    )
    outputDebug(`[OTEL] record ${Name.Elapsed} histogram stage="active" ${timing.active.toString()}ms`)
    outputDebug(`[OTEL] record ${Name.Elapsed} histogram stage="network" ${timing.network.toString()}ms`)
    outputDebug(`[OTEL] record ${Name.Elapsed} histogram stage="prompt" ${timing.prompt.toString()}ms`)
    return
  }

  if (timing.active > 0) {
    recorder.otel.record(Name.Duration, timing.active, labels)
    recorder.otel.record(Name.Elapsed, timing.active, {...labels, stage: 'active'})
  }
  if (timing.network > 0) {
    recorder.otel.record(Name.Elapsed, timing.network, {...labels, stage: 'network'})
  }
  if (timing.prompt > 0) {
    recorder.otel.record(Name.Elapsed, timing.prompt, {...labels, stage: 'prompt'})
  }
}
