import {RemoteTemplateSpecification} from '../../api/graphql/template_specifications.js'
import {TemplateSpecification} from '../../models/app/template.js'
import {BaseFunctionConfigurationSchema} from '../../models/extensions/schemas.js'
import {blocks} from '../../constants.js'
import themeSpecification from '../../models/templates/theme-specifications/theme.js'
import {testRemoteTemplateSpecifications} from '../../models/app/app.test-data.js'
import checkoutPostPurchaseExtension from '../../models/templates/ui-specifications/checkout_post_purchase.js'

export async function fetchTemplateSpecifications(token: string): Promise<RemoteTemplateSpecification[]> {
  // const result: RemoteTemplateSpecificationsQuerySchema = await partnersRequest(
  //   RemoteTemplateSpecificationsQuery,
  //   token,
  // )
  return testRemoteTemplateSpecifications.concat(themeSpecification).concat(checkoutPostPurchaseExtension)
}

export function mapRemoteTemplateSpecification(
  remoteTemplateSpecification: RemoteTemplateSpecification,
): TemplateSpecification {
  return {
    identifier: remoteTemplateSpecification.identifier,
    name: remoteTemplateSpecification.name,
    group: remoteTemplateSpecification.group,
    supportLinks: remoteTemplateSpecification.supportLinks,
    types: remoteTemplateSpecification.types.map((extension) => {
      return {
        identifier: remoteTemplateSpecification.identifier,
        externalIdentifier: remoteTemplateSpecification.identifier,
        externalName: remoteTemplateSpecification.identifier,
        gated: false,
        registrationLimit: blocks.functions.defaultRegistrationLimit,
        supportedFlavors: extension.supportedFlavors,
        group: remoteTemplateSpecification.group,
        category: () => 'function',
        configSchema: BaseFunctionConfigurationSchema,
        templateURL: extension.url,
        helpURL: remoteTemplateSpecification.supportLinks[0]!,
        templatePath: (flavor: string) => {
          const supportedFlavor = extension.supportedFlavors.find((supportedFlavor) => supportedFlavor.value === flavor)
          if (!supportedFlavor) return undefined
          return supportedFlavor.path
        },
      }
    }),
  }
}
