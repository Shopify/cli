import {
  RemoteTemplateSpecification,
  RemoteTemplateSpecificationsQuery,
  RemoteTemplateSpecificationsQuerySchema,
} from '../../api/graphql/template_specifications.js'
import {TemplateSpecification} from '../../models/app/template.js'
import {templates} from '../../constants.js'
import functionSpec from '../../models/extensions/ui-specifications/function.js'
import {ExtensionSpecification} from '../../models/extensions/ui.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function fetchTemplateSpecifications(token: string): Promise<TemplateSpecification[]> {
  const params: {version?: string} = {version: templates.specification.remoteVersion}
  const result: RemoteTemplateSpecificationsQuerySchema = await partnersRequest(
    RemoteTemplateSpecificationsQuery,
    token,
    params,
  )
  return result.templateSpecifications.map(mapRemoteTemplateSpecification)
}

export function mapRemoteTemplateSpecification(
  remoteTemplateSpecification: RemoteTemplateSpecification,
): TemplateSpecification {
  const spec = functionSpec as unknown as ExtensionSpecification
  return {
    identifier: remoteTemplateSpecification.identifier,
    name: remoteTemplateSpecification.name,
    group: remoteTemplateSpecification.group,
    supportLinks: remoteTemplateSpecification.supportLinks,
    types: [spec],
    //   return {
    //     ...spec,
    //     ...{
    //       registrationLimit: blocks.functions.defaultRegistrationLimit,
    //       supportedFlavors: extension.supportedFlavors,
    //       group: remoteTemplateSpecification.group,
    //       templateURL: extension.url,
    //       helpURL: remoteTemplateSpecification.supportLinks[0]!,
    //       templatePath: (lang?: string) => {
    //         const supportedFlavor = extension.supportedFlavors.find((supportedFlavor) => supportedFlavor.value === lang)
    //         if (!supportedFlavor) return undefined
    //         return supportedFlavor.path
    //       },
    //     },
    //   }
    // }),
  }
}
