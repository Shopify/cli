/**
 * Lightweight CLI bootstrap module.
 *
 * This file is the entry point for bin/dev.js and bin/run.js.
 * It intentionally does NOT import any command modules or heavy packages.
 * Commands are loaded lazily by oclif from the manifest + index.ts only when needed.
 */
import {createGlobalProxyAgent} from 'global-agent'
import {runCLI} from '@shopify/cli-kit/node/cli'
import {loadCommand} from './command-registry.js'

import fs from 'fs'

// Setup global support for environment variable based proxy configuration.
createGlobalProxyAgent({
  environmentVariableNamespace: 'SHOPIFY_',
  forceGlobalAgent: true,
  socketConnectionTimeout: 60000,
})

// In some cases (for example when we boot the proxy server), when an exception is
// thrown, no 'exit' signal is sent to the process. We don't understand this fully.
// This means that any cleanup code that depends on "process.on('exit', ...)" will
// not be called. The tunnel plugin is an example of that. Here we make sure to print
// the error stack and manually call exit so that the cleanup code is called. This
// makes sure that there are no lingering tunnel processes.
process.on('uncaughtException', async (err) => {
  try {
    const {FatalError} = await import('@shopify/cli-kit/node/error')
    if (err instanceof FatalError) {
      const {renderFatalError} = await import('@shopify/cli-kit/node/ui')
      renderFatalError(err)
    } else {
      fs.writeSync(process.stderr.fd, `${err.stack ?? err.message ?? err}\n`)
    }
  } catch {
    fs.writeSync(process.stderr.fd, `${err.stack ?? err.message ?? err}\n`)
  }
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
  await runCLI({
    moduleURL: import.meta.url,
    development,
    lazyCommandLoader: loadCommand,
  })
  // Force exit after command completes. Pending network requests (analytics,
  // version checks) are best-effort and shouldn't delay the user.
  process.exit(0)
}

export default runShopifyCLI
