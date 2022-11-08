import {ExtensionPointSpec} from '../models/extensions/extension-points.js'
import {ExtensionSpec} from '../models/extensions/extensions.js'
import {FunctionSpec} from '../models/extensions/functions.js'
import {plugins} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array.js'
import {flatten} from 'lodash-es'

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
  const hooks = await plugins.fanoutHooks<HookReturnPerExtensionPlugin, 'extension_spec'>(config, 'extension_spec', {})
  const specs = flatten(getArrayRejectingUndefined(Object.values(hooks)))
  return specs
}

export async function getListOfExtensionPoints(config: Config): Promise<ExtensionPointSpec[]> {
  const hooks = await plugins.fanoutHooks<HookReturnPerExtensionPlugin, 'extension_point'>(
    config,
    'extension_point',
    {},
  )
  const specs = flatten(getArrayRejectingUndefined(Object.values(hooks)))
  return specs
}

export async function getListOfFunctionSpecs(config: Config): Promise<FunctionSpec[]> {
  const hooks = await plugins.fanoutHooks<HookReturnPerExtensionPlugin, 'function_spec'>(config, 'function_spec', {})
  const specs = flatten(getArrayRejectingUndefined(Object.values(hooks)))
  return specs
}
