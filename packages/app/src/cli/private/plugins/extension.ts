import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {HookReturnPerExtensionPlugin} from '../../public/plugins/extension.js'
import {Config} from '@oclif/core'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {fanoutHooks} from '@shopify/cli-kit/node/plugins'
import flatten from 'lodash-es/flatten.js'

export async function loadUIExtensionSpecificiationsFromPlugins(config: Config): Promise<ExtensionSpecification[]> {
  const hooks = await fanoutHooks<HookReturnPerExtensionPlugin, 'extension_specs'>(config, 'extension_specs', {})
  const specs = flatten(getArrayRejectingUndefined(Object.values(hooks)))
  return specs
}
