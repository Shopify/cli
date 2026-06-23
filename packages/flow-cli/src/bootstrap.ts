import {runCLI} from '@shopify/cli-kit/node/cli'
import fs from 'fs'

process.on('uncaughtException', async (err) => {
  try {
    const {FatalError} = await import('@shopify/cli-kit/node/error')
    if (err instanceof FatalError) {
      const {renderFatalError} = await import('@shopify/cli-kit/node/ui')
      renderFatalError(err)
    } else {
      fs.writeSync(process.stderr.fd, `${err.stack ?? err.message ?? err}\n`)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    fs.writeSync(process.stderr.fd, `${err.stack ?? err.message ?? err}\n`)
  }
  process.exit(1)
})

for (const signal of ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const) {
  process.on(signal, () => process.exit(1))
}

interface RunOptions {
  development: boolean
}

async function runFlowCLI({development}: RunOptions) {
  await runCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runFlowCLI
