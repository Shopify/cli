import {ExtensionPointSpec} from '../models/extensions/extension-points.js'
import {ExtensionSpec} from '../models/extensions/extensions.js'
import {FunctionSpec} from '../models/extensions/functions.js'
import {plugins} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'

/**
 * Extension Plugins types
 *
 * Any plugin that provides extension definitions should implement `defineExtensionSpecs` and `defineExtensionPoints`
 */
interface HookReturnPerExtensionPlugin extends plugins.HookReturnsPerPlugin {
  extension_specs: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: ExtensionSpec[]
    }
  }
  extension_points: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: ExtensionPointSpec[]
    }
  }
  function_specs: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: FunctionSpec[]
    }
  }
}

export type ExtensionSpecsFunction = plugins.FanoutHookFunction<'extension_specs', ''>
export type ExtensionPointsFunction = plugins.FanoutHookFunction<'extension_points', ''>
export type FunctionSpecsFunction = plugins.FanoutHookFunction<'function_specs', ''>

export const defineExtensionSpecs = (input: ExtensionSpec): ExtensionSpecsFunction => {
  return async () => input
}

export const defineExtensionPoints = (input: ExtensionPointSpec): ExtensionPointsFunction => {
  return async () => input
}

export const defineFunctionSpecs = (input: FunctionSpec): FunctionSpecsFunction => {
  return async () => input
}

export async function getListOfExtensionSpecs(config: Config): Promise<ExtensionSpec[]> {
  const hooks = await plugins.fanoutHooks<HookReturnPerExtensionPlugin, 'extension_specs'>(
    config,
    'extension_specs',
    {},
  )
  const specs = getArrayRejectingUndefined(Object.values(hooks)).flat()
  return specs
}

export async function getListOfExtensionPoints(config: Config): Promise<ExtensionPointSpec[]> {
  const hooks = await plugins.fanoutHooks<HookReturnPerExtensionPlugin, 'extension_points'>(
    config,
    'extension_points',
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
