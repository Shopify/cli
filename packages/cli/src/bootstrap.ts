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

/**
 * Fast path for lightweight commands (help, version).
 * Reads the oclif manifest directly and renders output without loading
 * the full oclif framework. Saves ~150ms of startup overhead.
 */
function tryFastPath(): boolean {
  const args = process.argv.slice(2)
  const cmd = args[0]

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeFs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodePath = require('path') as typeof import('path')
  const {fileURLToPath} = require('url') as typeof import('url')

  // Resolve paths relative to this module (works in both tsc and bundle)
  const thisDir = nodePath.dirname(fileURLToPath(import.meta.url))
  const cliRoot = nodePath.resolve(thisDir, '..')

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    const pkg = JSON.parse(nodeFs.readFileSync(nodePath.join(cliRoot, 'package.json'), 'utf8'))
    process.stdout.write(`${pkg.version}\n`)
    return true
  }

  if (cmd === 'help' && args.length <= 1 && !args.includes('--nested-commands') && !args.includes('-n')) {
    const pkg = JSON.parse(nodeFs.readFileSync(nodePath.join(cliRoot, 'package.json'), 'utf8'))
    const manifestPath = nodePath.join(cliRoot, 'oclif.manifest.json')
    if (nodeFs.existsSync(manifestPath)) {
      const manifest = JSON.parse(nodeFs.readFileSync(manifestPath, 'utf8'))
      const commands = Object.entries(manifest.commands) as [string, {description?: string; hidden?: boolean}][]

      // Collect topics
      const topics = new Map<string, string>()
      const topLevelCommands: [string, string][] = []
      for (const [id, meta] of commands) {
        if (meta.hidden) continue
        const parts = id.split(':')
        if (parts.length > 1) {
          if (!topics.has(parts[0]!)) {
            topics.set(parts[0]!, meta.description?.split('.')[0] ?? '')
          }
        } else {
          topLevelCommands.push([id, meta.description?.split('.')[0] ?? ''])
        }
      }

      const lines: string[] = []
      lines.push(`${pkg.oclif?.description ?? 'Shopify CLI'}\n`)
      lines.push(`VERSION`)
      lines.push(`  ${pkg.name}/${pkg.version} ${process.platform}-${process.arch} node-${process.version}\n`)
      lines.push(`USAGE`)
      lines.push(`  $ shopify [COMMAND]\n`)

      if (topics.size > 0) {
        lines.push(`TOPICS`)
        const sorted = [...topics.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        const maxLen = Math.max(...sorted.map(([t]) => t.length))
        for (const [topic, desc] of sorted) {
          lines.push(`  ${topic.padEnd(maxLen + 2)}${desc}`)
        }
        lines.push('')
      }

      if (topLevelCommands.length > 0) {
        lines.push(`COMMANDS`)
        const sorted = topLevelCommands.sort((a, b) => a[0].localeCompare(b[0]))
        const maxLen = Math.max(...sorted.map(([c]) => c.length))
        for (const [cmdName, desc] of sorted) {
          lines.push(`  ${cmdName.padEnd(maxLen + 2)}${desc}`)
        }
        lines.push('')
      }

      process.stdout.write(lines.join('\n') + '\n')
      return true
    }
  }

  return false
}

async function runShopifyCLI({development}: RunShopifyCLIOptions) {
  // Try fast path for simple commands first
  if (tryFastPath()) {
    process.exit(0)
    return
  }

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
