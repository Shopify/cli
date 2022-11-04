import {json} from '@shopify/cli-kit'
import {
  ExtensionSpecFunction,
  ExtensionPointFunction,
  FunctionSpecFunction,
} from '@shopify/cli-kit/node/plugins/extension'

export const defineExtensionSpec = (input: json.JsonMap): ExtensionSpecFunction => {
  return async () => input
}

export const defineExtensionPoint = (input: json.JsonMap): ExtensionPointFunction => {
  return async () => input
}

export const defineFunctionSpec = (input: json.JsonMap): FunctionSpecFunction => {
  return async () => input
}
