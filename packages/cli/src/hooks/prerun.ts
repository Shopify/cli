import {Hook} from '@oclif/core'

// Map command ID prefixes to their source plugin names for analytics attribution.
const PLUGIN_NAME_MAP: Record<string, string> = {
  'app:': '@shopify/plugin-app',
  'webhook:': '@shopify/plugin-app',
  'demo:': '@shopify/plugin-app',
  'organization:': '@shopify/plugin-app',
  'theme:': '@shopify/plugin-theme',
  'hydrogen:': '@shopify/plugin-hydrogen',
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

const prerunHook: Hook.Prerun = async function (this, options) {
  // Set customPluginName for analytics attribution
  const pluginName = getPluginName(options.Command.id)
  if (pluginName) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(options.Command as any).customPluginName = pluginName
  }

  // Delegate to the standard cli-kit prerun hook
  const {hook} = await import('@shopify/cli-kit/node/hooks/prerun')
  return hook.call(this, options)
}

export default prerunHook
