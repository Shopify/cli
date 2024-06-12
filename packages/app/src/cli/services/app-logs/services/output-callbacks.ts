import {AppLogsOnFunctionRunCallback, AppLogsOnErrorCallback} from '../types.js'
import {writeAppLogsToFile} from '../write-app-logs.js'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {createLogsDir} from '@shopify/cli-kit/node/logs'
import {Writable} from 'stream'

const ONE_MILLION = 1000000

const appLogsDevOutput: AppLogsOnFunctionRunCallback = async ({stdout, log, apiKey}) => {
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

const appLogsDevErrorOutput: AppLogsOnErrorCallback = ({stdout}: {stdout: Writable}) => {
  stdout.write(`Error while retrieving app logs.`)
  stdout.write('App log streaming is no longer available in this `dev` session.')
}

export const DEV_OUTPUT_CALLBACKS = {
  onFunctionRunCallback: appLogsDevOutput,
  onErrorCallback: appLogsDevErrorOutput,
}
