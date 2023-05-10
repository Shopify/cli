import {UIExtensionSpec} from '../../models/extensions/ui.js'
import {HookReturnPerExtensionPlugin} from '../../public/plugins/extension.js'
import {Config} from '@oclif/core'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {fanoutHooks} from '@shopify/cli-kit/node/plugins'

export async function loadUIExtensionSpecificiationsFromPlugins(config: Config): Promise<UIExtensionSpec[]> {
  const hooks = await fanoutHooks<HookReturnPerExtensionPlugin, 'extension_specs'>(config, 'extension_specs', {})
  const specs = getArrayRejectingUndefined(Object.values(hooks)).flat()
  return specs
}
