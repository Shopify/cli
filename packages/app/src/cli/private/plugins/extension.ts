import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {HookReturnPerExtensionPlugin} from '../../public/plugins/extension.js'
import {Config} from '@oclif/core'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {fanoutHooks} from '@shopify/cli-kit/node/plugins'

export async function loadUIExtensionSpecificationsFromPlugins(config: Config): Promise<ExtensionSpecification[]> {
  const hooks = await fanoutHooks<HookReturnPerExtensionPlugin, 'extension_specs'>(config, 'extension_specs', {})
  const specs = getArrayRejectingUndefined(Object.values(hooks)).flat()
  return specs
}
