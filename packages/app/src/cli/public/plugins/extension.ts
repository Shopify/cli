import {UIExtensionSpec} from '../../models/extensions/ui.js'
import {FunctionSpec} from '../../models/extensions/functions.js'
import {BaseConfigContents} from '../../models/extensions/schemas.js'
import {plugins} from '@shopify/cli-kit'

export {createUIExtensionSpecification, UIExtensionSpec, CreateExtensionSpecType} from '../../models/extensions/ui.js'
export {createFunctionSpecification, FunctionSpec, CreateFunctionSpecType} from '../../models/extensions/functions.js'
export {fetchProductVariant} from '../../utilities/extensions/fetch-product-variant.js'
export {loadLocalesConfig} from '../../utilities/extensions/locales-configuration.js'

export * from '../../models/extensions/schemas.js'

/**
 * Extension Plugins types.
 *
 * Any plugin that provides extension definitions should implement `defineExtensionSpecs`.
 */
export interface HookReturnPerExtensionPlugin extends plugins.HookReturnsPerPlugin {
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

/**
 * A function for plugins to register new UI extension types.
 *
 * @param specifications - The UI extension specifications to register.
 * @returns A function that returns the list of specifications.
 * @example
 */
export const registerUIExtensionSpecifications = <TConfiguration extends BaseConfigContents = BaseConfigContents>(
  specifications: UIExtensionSpec<TConfiguration>[],
): ExtensionSpecsFunction => {
  return async () => specifications as UIExtensionSpec[]
}

/**
 * A function for plugins to register new function types.
 *
 * @param specifications - The function specifications to register.
 * @returns A function that returns the list of specifications.
 * @example
 */
export const registerFunctionSpecifications = (specifications: FunctionSpec[]): FunctionSpecsFunction => {
  return async () => specifications
}
