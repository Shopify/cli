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
 * Any plugin that provides extension definitions should implement `defineExtensionSpec` and `defineExtensionPoint`
 */
interface HookReturnPerExtensionPlugin extends plugins.HookReturnsPerPlugin {
  extension_spec: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: ExtensionSpec[]
    }
  }
  extension_point: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: ExtensionPointSpec[]
    }
  }
  function_spec: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: FunctionSpec[]
    }
  }
}

export type ExtensionSpecFunction = plugins.FanoutHookFunction<'extension_spec', ''>
export type ExtensionPointFunction = plugins.FanoutHookFunction<'extension_point', ''>
export type FunctionSpecFunction = plugins.FanoutHookFunction<'function_spec', ''>

export const defineExtensionSpec = (input: ExtensionSpec): ExtensionSpecFunction => {
  return async () => input
}

export const defineExtensionPoint = (input: ExtensionPointSpec): ExtensionPointFunction => {
  return async () => input
}

export const defineFunctionSpec = (input: FunctionSpec): FunctionSpecFunction => {
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
