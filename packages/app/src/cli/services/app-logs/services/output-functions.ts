import {
  AppLogsPollingCommandOutputFunction,
  AppLogsPollingCommandRetryOutputFunction,
  AppLogsPollingCommandErrorOutputFunction,
} from '../types.js'
import {writeAppLogsToFile} from '../write-app-logs.js'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {Response} from 'node-fetch'
import {createLogsDir} from '@shopify/cli-kit/node/logs'
import {Writable} from 'stream'

const POLLING_BACKOFF_INTERVAL_MS = 10000
const ONE_MILLION = 1000000

export const appLogsDevOutput: AppLogsPollingCommandOutputFunction = async ({stdout, log, apiKey}) => {
  await createLogsDir(apiKey!)

  await useConcurrentOutputContext({outputPrefix: log.source}, async () => {
    const payload = JSON.parse(log.payload)
    if (log.event_type === 'function_run') {
      const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)

      if (log.status === 'success') {
        stdout.write(`Function executed successfully using ${fuel}M instructions.`)
      } else if (log.status === 'failure') {
        stdout.write(`❌ Function failed to execute with error: ${payload.error_type}`)
      }

      const logs = payload.logs
      if (logs.length > 0) {
        stdout.write(logs)
      }
    } else {
      stdout.write(JSON.stringify(payload))
    }

    await writeAppLogsToFile({
      appLog: log,
      apiKey: apiKey ?? '',
      stdout,
    })
  })
}

export const appLogsDevRetryOutput: AppLogsPollingCommandRetryOutputFunction = async ({
  stdout,
  response,
}: {
  stdout: Writable
  response: Response
  apiKey?: string
}) => {
  const responseText = await response.text()
  stdout.write(`Received an error while polling for app logs.`)
  stdout.write(`${response.status}: ${response.statusText}`)
  stdout.write(responseText)
  stdout.write(`Retrying in ${POLLING_BACKOFF_INTERVAL_MS / 1000} seconds`)
}

export const appLogsDevErrorOutput: AppLogsPollingCommandErrorOutputFunction = ({stdout}: {stdout: Writable}) => {
  stdout.write(`Error while retrieving app logs.`)
  stdout.write('App log streaming is no longer available in this `dev` session.')
}

export const appLogsLogsRetryOutput: AppLogsPollingCommandRetryOutputFunction = async ({
  stdout,
  response,
}: {
  stdout: Writable
  response: Response
  apiKey?: string
}) => {
  const responseText = await response.text()
  // stdout.write(`Received an error while polling for app logs.`)
  // stdout.write(`${response.status}: ${response.statusText}`)
  // stdout.write(responseText)
  // stdout.write(`Retrying in ${POLLING_BACKOFF_INTERVAL_MS / 1000} seconds`)
}

export const appLogsLogsErrorOutput: AppLogsPollingCommandErrorOutputFunction = ({stdout}: {stdout: Writable}) => {
  // stdout.write(`Error while retrieving app logs.`)
  // stdout.write('App log streaming is no longer available in this `dev` session.')
}

export const appLogsLogsOutput: AppLogsPollingCommandOutputFunction = ({stdout, log, apiKey}) => {
  const {status} = log
  const parsedPayload = JSON.parse(log.payload)
  const {logs, input, input_bytes: inputBytes, function_id: functionId, fuel_consumed: fuelConsumed} = parsedPayload
  const fuel = (fuelConsumed / ONE_MILLION).toFixed(4)

  const toWrite = JSON.stringify({
    source: log.source,
    status,
    functionId,
    fuelConsumed: fuel,
    logs,
    input,
    inputBytes,
  })

  stdout.write(toWrite)
}

export const DEV_OUTPUT_FUNCTIONS = {
  commandOutputFunction: appLogsDevOutput,
  retryOutputFunction: appLogsDevRetryOutput,
  errorOutputFunction: appLogsDevErrorOutput,
}

export const LOG_OUTPUT_FUNCTIONS = {
  commandOutputFunction: appLogsLogsOutput,
  retryOutputFunction: appLogsLogsRetryOutput,
  errorOutputFunction: appLogsLogsErrorOutput,
}
