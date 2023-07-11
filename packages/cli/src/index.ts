import {runCLI, useLocalCLIIfDetected} from '@shopify/cli-kit/node/cli'
// eslint-disable-next-line @shopify/cli/specific-imports-in-bootstrap-code
import fs from 'fs'

// In some cases (for example when we boot the proxy server), when an exception is
// thrown, no 'exit' signal is sent to the process. We don't understand this fully.
// This means that any cleanup code that depends on "process.on('exit', ...)" will
// not be called. The tunnel plugin is an example of that. Here we make sure to print
// the error stack and manually call exit so that the cleanup code is called. This
// makes sure that there are no lingering tunnel processes.
process.on('uncaughtException', (err) => {
  fs.writeSync(process.stderr.fd, `${err.stack}\n`)
  process.exit(1)
})
const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT']
signals.forEach((signal) => {
  process.on(signal, () => {
    process.exit(1)
  })
})

// Sometimes we want to specify a precise amount of stdout columns, for example in
// CI or on a cloud environment.
const columns = Number(process.env.SHOPIFY_CLI_COLUMNS)
if (!isNaN(columns)) {
  process.stdout.columns = columns
}

interface RunShopifyCLIOptions {
  development: boolean
}

async function runShopifyCLI({development}: RunShopifyCLIOptions) {
  if (!development) {
    // If we run a local CLI instead, don't run the global one again after!
    const ranLocalInstead = await useLocalCLIIfDetected(import.meta.url)
    if (ranLocalInstead) {
      return
    }
  }

  await runCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runShopifyCLI
