import {BaseConfigType} from './extension.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {FanoutHookFunction, HookReturnsPerPlugin} from '@shopify/cli-kit/node/plugins'

export {
  createExtensionSpecification,
  ExtensionSpecification,
  CreateExtensionSpecType,
} from '../../models/extensions/specification.js'
export {fetchProductVariant} from '../../utilities/extensions/fetch-product-variant.js'
export {loadLocalesConfig} from '../../utilities/extensions/locales-configuration.js'

export * from '../../models/extensions/schemas.js'

/**
 * Extension Plugins types.
 *
 * Any plugin that provides extension definitions should implement `defineExtensionSpecs`.
 */
export interface HookReturnPerExtensionPlugin extends HookReturnsPerPlugin {
  extension_specs: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: ExtensionSpecification[]
    }
  }
}

export type ExtensionSpecsFunction = FanoutHookFunction<'extension_specs', '', HookReturnPerExtensionPlugin>

/**
 * A function for plugins to register new UI extension types.
 *
 * @param specifications - The UI extension specifications to register.
 * @returns A function that returns the list of specifications.
 * @example
 */
export const registerUIExtensionSpecifications = <TConfiguration extends BaseConfigType = BaseConfigType>(
  specifications: ExtensionSpecification<TConfiguration>[],
): ExtensionSpecsFunction => {
  return async () => specifications as ExtensionSpecification[]
}
