import {runCLI, useLocalCLIIfDetected} from '@shopify/cli-kit/node/cli'
// eslint-disable-next-line rulesdir/specific-imports-in-bootstrap-code
import fs from 'fs'

// In some cases (for example when we boot the proxy server), when an exception is
// thrown, no 'exit' signal is sent to the process. We don't understand this fully.
// This means that any cleanup code that depends on "process.on('exit', ...)" will
// not be called. The ngrok plugin is an example of that. Here we make sure to print
// the error stack and manually call exit so that the cleanup code is called. This
// makes sure that there are no lingering ngrok processes.
process.on('uncaughtException', (err) => {
  fs.writeSync(process.stderr.fd, `${err.stack}\n\n`)
  process.exit(1)
})

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
