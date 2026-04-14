import {Hook} from '@oclif/core'

// Map command ID prefixes to their source plugin names for analytics attribution.
const PLUGIN_NAME_MAP: Record<string, string> = {
  'app:': '@shopify/app',
  'webhook:': '@shopify/app',
  'demo:': '@shopify/app',
  'organization:': '@shopify/app',
  'theme:': '@shopify/theme',
  'hydrogen:': '@shopify/cli-hydrogen',
  'commands': '@oclif/plugin-commands',
  'plugins': '@oclif/plugin-plugins',
  'config:autocorrect:': '@shopify/plugin-did-you-mean',
}

function getPluginName(commandId: string): string | undefined {
  for (const [prefix, pluginName] of Object.entries(PLUGIN_NAME_MAP)) {
    if (commandId === prefix || commandId.startsWith(prefix)) {
      return pluginName
    }
  }
  return undefined
}

// Track whether deferred init hooks have been run
let appInitDone = false
let hydrogenInitDone = false

const prerunHook: Hook.Prerun = async function (this, options) {
  // Set customPluginName for analytics attribution
  const pluginName = getPluginName(options.Command.id)
  if (pluginName) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(options.Command as any).customPluginName = pluginName
  }

  // Run deferred init hooks lazily on first relevant command
  const commandId = options.Command.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initOpts: any = {id: commandId, argv: options.argv, config: options.config}
  if (!appInitDone && (commandId.startsWith('app:') || commandId === 'webhook:trigger' || commandId === 'demo:watcher' || commandId === 'organization:list')) {
    appInitDone = true
    const {AppInitHook} = await import('@shopify/app')
    await AppInitHook.call(this, initOpts)
  }

  if (!hydrogenInitDone && commandId.startsWith('hydrogen:')) {
    hydrogenInitDone = true
    const {HOOKS} = await import('@shopify/cli-hydrogen')
    await (HOOKS.init as Function).call(this, initOpts)
  }

  // Delegate to the standard cli-kit prerun hook
  const {hook} = await import('@shopify/cli-kit/node/hooks/prerun')
  return hook.call(this, options)
}

export default prerunHook
