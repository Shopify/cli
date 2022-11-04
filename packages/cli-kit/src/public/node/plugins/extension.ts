import {ExtendableError} from '../../../error.js'
import {JsonMap} from '../../../json.js'
import {FanoutHookFunction} from '../../../plugins.js'

export type ExtensionErrorType = 'unknown'
export class ExtensionError extends ExtendableError {
  type: ExtensionErrorType
  constructor(type: ExtensionErrorType, message?: string) {
    super(message)
    this.type = type
  }
}

/**
 * Extension Plugins types
 *
 * Any plugin that provides extension definitions should implement `defineExtensionSpec` and `defineExtensionPoint`
 */
export interface HookReturnPerExtensionPlugin {
  extension_spec: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: JsonMap
    }
  }
  extension_point: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: JsonMap
    }
  }
  function_spec: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: JsonMap
    }
  }
}

export type ExtensionSpecFunction = FanoutHookFunction<'extension_spec', ''>
export type ExtensionPointFunction = FanoutHookFunction<'extension_point', ''>
export type FunctionSpecFunction = FanoutHookFunction<'function_spec', ''>
