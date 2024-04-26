/* eslint-disable @shopify/cli/specific-imports-in-bootstrap-code */
import VersionCommand from './cli/commands/version.js'
import Search from './cli/commands/search.js'
import Upgrade from './cli/commands/upgrade.js'
import Logout from './cli/commands/auth/logout.js'
import CommandFlags from './cli/commands/debug/command-flags.js'
import Catalog from './cli/commands/demo/catalog.js'
import GenerateFile from './cli/commands/demo/generate-file.js'
import PrintAIPrompt from './cli/commands/demo/print-ai-prompt.js'
import KitchenSinkAsync from './cli/commands/kitchen-sink/async.js'
import KitchenSinkPrompts from './cli/commands/kitchen-sink/prompts.js'
import KitchenSinkStatic from './cli/commands/kitchen-sink/static.js'
import HydrogenInit from './cli/commands/hydrogen/init.js'
import DocsGenerate from './cli/commands/docs/generate.js'
import HelpCommand from './cli/commands/help.js'
import AppCommands from '@shopify/app'
import ThemeCommands from '@shopify/theme'
import {commands as PluginCommandsCommands} from '@oclif/plugin-commands'
import {commands as PluginPluginsCommands} from '@oclif/plugin-plugins'
import {DidYouMeanCommands} from '@shopify/plugin-did-you-mean'
import {runCLI, useLocalCLIIfDetected} from '@shopify/cli-kit/node/cli'
import fs from 'fs'

export {DidYouMeanHook} from '@shopify/plugin-did-you-mean'
export {default as TunnelStartHook} from '@shopify/plugin-cloudflare/hooks/tunnel'
export {default as TunnelProviderHook} from '@shopify/plugin-cloudflare/hooks/provider'
export {hooks as PluginHook} from '@oclif/plugin-plugins'

// In some cases (for example when we boot the proxy server), when an exception is
// thrown, no 'exit' signal is sent to the process. We don't understand this fully.
// This means that any cleanup code that depends on "process.on('exit', ...)" will
// not be called. The tunnel plugin is an example of that. Here we make sure to print
// the error stack and manually call exit so that the cleanup code is called. This
// makes sure that there are no lingering tunnel processes.
process.on('uncaughtException', (err) => {
  fs.writeSync(process.stderr.fd, `${err.stack || err.message || err}\n`)
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

// Hide plugins command
PluginPluginsCommands.plugins.hidden = true

// Remove default description because it injects a path from the generating computer, making it fail on CI
PluginPluginsCommands['plugins:install'].description = ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COMMANDS: any = {
  ...AppCommands,
  ...ThemeCommands,
  ...PluginPluginsCommands,
  ...DidYouMeanCommands,
  ...PluginCommandsCommands,
  search: Search,
  upgrade: Upgrade,
  version: VersionCommand,
  help: HelpCommand,
  'auth:logout': Logout,
  'debug:command-flags': CommandFlags,
  'demo:catalog': Catalog,
  'demo:generate-file': GenerateFile,
  'demo:print-ai-prompt': PrintAIPrompt,
  'kitchen-sink:async': KitchenSinkAsync,
  'kitchen-sink:prompts': KitchenSinkPrompts,
  'kitchen-sink:static': KitchenSinkStatic,
  'hydrogen:init': HydrogenInit,
  'docs:generate': DocsGenerate,
}

export default runShopifyCLI
