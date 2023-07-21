import {
  RemoteTemplateSpecificationsQuery,
  RemoteTemplateSpecificationsQuerySchema,
} from '../../api/graphql/template_specifications.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import themeExtension from '../../models/templates/theme-specifications/theme.js'
import productSubscriptionUIExtension from '../../models/templates/ui-specifications/product_subscription.js'
import webPixelUIExtension from '../../models/templates/ui-specifications/web_pixel_extension.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function fetchExtensionTemplates(
  token: string,
  apiKey: string,
  availableSpecifications: string[],
): Promise<ExtensionTemplate[]> {
  const remoteTemplates: RemoteTemplateSpecificationsQuerySchema = await partnersRequest(
    RemoteTemplateSpecificationsQuery,
    token,
    {apiKey},
  )
  const remoteIDs = remoteTemplates.templateSpecifications.map((template) => template.identifier)
  // Filter out local templates that are already available remotely to avoid duplicates
  const lcoalTemplates = localExtensionTemplates().filter((template) => !remoteIDs.includes(template.identifier))
  const allTemplates = remoteTemplates.templateSpecifications.concat(lcoalTemplates)
  return allTemplates.filter(
    (template) =>
      availableSpecifications.includes(template.identifier) ||
      availableSpecifications.includes(template.types[0]!.type),
  )
}

export function localExtensionTemplates(): ExtensionTemplate[] {
  return [themeExtension, productSubscriptionUIExtension, webPixelUIExtension]
}
