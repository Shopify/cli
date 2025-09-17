import {ExtensionTemplatesResult} from '../../models/app/template.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {isPolarisUnifiedEnabled} from '@shopify/cli-kit/node/is-polaris-unified-enabled'

export async function fetchExtensionTemplates(
  developerPlatformClient: DeveloperPlatformClient,
  app: MinimalAppIdentifiers,
  availableSpecifications: string[],
  shouldUsePolarisUnified?: boolean,
): Promise<ExtensionTemplatesResult> {
  const {templates: remoteTemplates, groupOrder} = await developerPlatformClient.templateSpecifications(app)
  const polarisUnifiedEnabled = shouldUsePolarisUnified ?? isPolarisUnifiedEnabled()

  const filteredTemplates = remoteTemplates
    .filter(
      (template) =>
        availableSpecifications.includes(template.identifier) || availableSpecifications.includes(template.type),
    )
    .map((template) => {
      if (template.type === 'ui_extension') {
        return {
          ...template,
          supportedFlavors: template.supportedFlavors.filter((flavor) =>
            polarisUnifiedEnabled ? flavor.value === 'preact' : flavor.value !== 'preact',
          ),
        }
      }
      return template
    })
    .filter((template) => template.supportedFlavors.length > 0)

  return {
    templates: filteredTemplates,
    groupOrder,
  }
}
