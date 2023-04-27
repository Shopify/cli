import {
  RemoteTemplateSpecification,
  RemoteTemplateSpecificationsQuery,
  RemoteTemplateSpecificationsQuerySchema,
} from '../../api/graphql/template_specifications.js'
import themeSpecification from '../../models/templates/theme-specifications/theme.js'
import checkoutPostPurchaseExtension from '../../models/templates/ui-specifications/checkout_post_purchase.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function fetchTemplateSpecifications(token: string): Promise<RemoteTemplateSpecification[]> {
  const remoteTemplates: RemoteTemplateSpecificationsQuerySchema = await partnersRequest(
    RemoteTemplateSpecificationsQuery,
    token,
  )
  return remoteTemplates.templateSpecifications.concat(localSpecifications())
}

function localSpecifications() {
  return [themeSpecification, checkoutPostPurchaseExtension]
}
