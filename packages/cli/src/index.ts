/* eslint-disable @shopify/cli/specific-imports-in-bootstrap-code */
import VersionCommand from './cli/commands/version.js'
import Search from './cli/commands/search.js'
import Upgrade from './cli/commands/upgrade.js'
import Logout from './cli/commands/auth/logout.js'
import CommandFlags from './cli/commands/debug/command-flags.js'
import KitchenSinkAsync from './cli/commands/kitchen-sink/async.js'
import KitchenSinkPrompts from './cli/commands/kitchen-sink/prompts.js'
import KitchenSinkStatic from './cli/commands/kitchen-sink/static.js'
import KitchenSink from './cli/commands/kitchen-sink/index.js'
import DocsGenerate from './cli/commands/docs/generate.js'
import HelpCommand from './cli/commands/help.js'
import List from './cli/commands/notifications/list.js'
import Generate from './cli/commands/notifications/generate.js'
import ClearCache from './cli/commands/cache/clear.js'
import {createGlobalProxyAgent} from 'global-agent'
import ThemeCommands from '@shopify/theme'
import {COMMANDS as HydrogenCommands, HOOKS as HydrogenHooks} from '@shopify/cli-hydrogen'
import {commands as AppCommands} from '@shopify/app'
import {commands as PluginCommandsCommands} from '@oclif/plugin-commands'
import {commands as PluginPluginsCommands} from '@oclif/plugin-plugins'
import {DidYouMeanCommands} from '@shopify/plugin-did-you-mean'
import {runCLI} from '@shopify/cli-kit/node/cli'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {FatalError} from '@shopify/cli-kit/node/error'
import fs from 'fs'

export {DidYouMeanHook} from '@shopify/plugin-did-you-mean'
export {default as TunnelStartHook} from '@shopify/plugin-cloudflare/hooks/tunnel'
export {default as TunnelProviderHook} from '@shopify/plugin-cloudflare/hooks/provider'
export {hooks as PluginHook} from '@oclif/plugin-plugins'
export {AppSensitiveMetadataHook, AppInitHook, AppPublicMetadataHook} from '@shopify/app'
export {push, pull, fetchStoreThemes} from '@shopify/theme'

export const HydrogenInitHook = HydrogenHooks.init

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
process.on('uncaughtException', (err) => {
  if (err instanceof FatalError) {
    renderFatalError(err)
  } else {
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
  })
}

// Hide plugins command
PluginPluginsCommands.plugins.hidden = true

// Remove default description because it injects a path from the generating computer, making it fail on CI
PluginPluginsCommands['plugins:install'].description = ''

const appCommands = Object.keys(AppCommands) as (keyof typeof AppCommands)[]
appCommands.forEach((command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(AppCommands[command] as unknown as any).customPluginName = '@shopify/app'
})

const themeCommands = Object.keys(ThemeCommands) as (keyof typeof ThemeCommands)[]
themeCommands.forEach((command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(ThemeCommands[command] as any).customPluginName = '@shopify/theme'
})

const hydrogenCommands = Object.keys(HydrogenCommands) as (keyof typeof HydrogenCommands)[]
hydrogenCommands.forEach((command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(HydrogenCommands[command] as any).customPluginName = '@shopify/cli-hydrogen'
})

const pluginCommandsCommands = Object.keys(PluginCommandsCommands) as (keyof typeof PluginCommandsCommands)[]
pluginCommandsCommands.forEach((command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(PluginCommandsCommands[command] as any).customPluginName = '@oclif/plugin-commands'
})

const didYouMeanCommands = Object.keys(DidYouMeanCommands) as (keyof typeof DidYouMeanCommands)[]
didYouMeanCommands.forEach((command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(DidYouMeanCommands[command] as any).customPluginName = '@shopify/plugin-did-you-mean'
})

const pluginPluginsCommands = Object.keys(PluginPluginsCommands) as (keyof typeof PluginPluginsCommands)[]
pluginPluginsCommands.forEach((command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(PluginPluginsCommands[command] as any).customPluginName = '@oclif/plugin-plugins'
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COMMANDS: any = {
  ...AppCommands,
  ...ThemeCommands,
  ...PluginPluginsCommands,
  ...DidYouMeanCommands,
  ...PluginCommandsCommands,
  ...HydrogenCommands,
  search: Search,
  upgrade: Upgrade,
  version: VersionCommand,
  help: HelpCommand,
  'auth:logout': Logout,
  'debug:command-flags': CommandFlags,
  'kitchen-sink': KitchenSink,
  'kitchen-sink:async': KitchenSinkAsync,
  'kitchen-sink:prompts': KitchenSinkPrompts,
  'kitchen-sink:static': KitchenSinkStatic,
  'docs:generate': DocsGenerate,
  'notifications:list': List,
  'notifications:generate': Generate,
  'cache:clear': ClearCache,
}

export default runShopifyCLI
