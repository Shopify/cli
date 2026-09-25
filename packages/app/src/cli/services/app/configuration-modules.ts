import {ConfigurationModule, ExtensionSpecification} from '../../models/extensions/specification.js'
import {Flag} from '../../utilities/developer-platform-client.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

export interface ConfigurationModuleEntry {
  specification: ExtensionSpecification
  module: ConfigurationModule
}

/** Aggregate opted-in specifications once; preserve scalar transform order and caller-specific fallbacks. */
export function configurationFromModules<T extends ConfigurationModuleEntry>(
  entries: ReadonlyArray<T>,
  flags: Flag[],
  transform: (entry: T) => object,
): {[key: string]: unknown} {
  const groups = new Map<ExtensionSpecification, ConfigurationModule[]>()
  for (const {specification, module} of entries) {
    if (!specification.aggregateModuleConfigurations) continue
    const group = groups.get(specification) ?? []
    group.push(module)
    groups.set(specification, group)
  }

  let configuration: {[key: string]: unknown} = {}
  for (const entry of entries) {
    const aggregate = entry.specification.aggregateModuleConfigurations
    if (aggregate) {
      const group = groups.get(entry.specification)
      if (!group) continue
      configuration = deepMergeObjects(configuration, aggregate(group, {flags}))
      groups.delete(entry.specification)
    } else {
      configuration = deepMergeObjects(configuration, transform(entry))
    }
  }
  return configuration
}
