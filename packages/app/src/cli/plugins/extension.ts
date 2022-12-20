import {UIExtensionSpec} from '../models/extensions/ui.js'
import {FunctionSpec} from '../models/extensions/functions.js'
import {BaseConfigContents} from '../models/extensions/schemas.js'
import {plugins} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
/**
 * Extension Plugins types
 *
 * Any plugin that provides extension definitions should implement `defineExtensionSpecs`
 */
interface HookReturnPerExtensionPlugin extends plugins.HookReturnsPerPlugin {
  extension_specs: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: UIExtensionSpec[]
    }
  }
  function_specs: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: FunctionSpec[]
    }
  }
}

export type ExtensionSpecsFunction = plugins.FanoutHookFunction<'extension_specs', '', HookReturnPerExtensionPlugin>
export type FunctionSpecsFunction = plugins.FanoutHookFunction<'function_specs', '', HookReturnPerExtensionPlugin>

export const registerUIExtensionSpecs = <TConfiguration extends BaseConfigContents = BaseConfigContents>(
  input: UIExtensionSpec<TConfiguration>[],
): ExtensionSpecsFunction => {
  return async () => input as UIExtensionSpec[]
}

export const registerFunctionSpecs = (input: FunctionSpec[]): FunctionSpecsFunction => {
  return async () => input
}

export async function getListOfExtensionSpecs(config: Config): Promise<UIExtensionSpec[]> {
  const hooks = await plugins.fanoutHooks<HookReturnPerExtensionPlugin, 'extension_specs'>(
    config,
    'extension_specs',
    {},
  )
  const specs = getArrayRejectingUndefined(Object.values(hooks)).flat()
  return specs
}
export async function getListOfFunctionSpecs(config: Config): Promise<FunctionSpec[]> {
  const hooks = await plugins.fanoutHooks<HookReturnPerExtensionPlugin, 'function_specs'>(config, 'function_specs', {})
  const specs = getArrayRejectingUndefined(Object.values(hooks)).flat()
  return specs
}
