import {ExtensionTemplate} from '../../models/app/template.js'
import themeExtension from '../../models/templates/theme-specifications/theme.js'
import productSubscriptionUIExtension from '../../models/templates/ui-specifications/product_subscription.js'
import webPixelUIExtension from '../../models/templates/ui-specifications/web_pixel_extension.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export async function fetchExtensionTemplates(
  developerPlatformClient: DeveloperPlatformClient,
  apiKey: string,
  availableSpecifications: string[],
): Promise<ExtensionTemplate[]> {
  const remoteTemplates: ExtensionTemplate[] = await developerPlatformClient.templateSpecifications(apiKey)
  const remoteIDs = remoteTemplates.map((template) => template.identifier)
  // Filter out local templates that are already available remotely to avoid duplicates
  const lcoalTemplates = localExtensionTemplates().filter((template) => !remoteIDs.includes(template.identifier))
  const allTemplates = remoteTemplates.concat(lcoalTemplates)
  return allTemplates.filter(
    (template) =>
      availableSpecifications.includes(template.identifier) ||
      availableSpecifications.includes(template.types[0]!.type),
  )
}

function localExtensionTemplates(): ExtensionTemplate[] {
  return [themeExtension, productSubscriptionUIExtension, webPixelUIExtension]
}
