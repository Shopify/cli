import {
  RemoteTemplateSpecification,
  RemoteTemplateSpecificationsQuery,
  RemoteTemplateSpecificationsQuerySchema,
} from '../../api/graphql/template_specifications.js'
import {TemplateSpecification} from '../../models/app/template.js'
import {BaseFunctionConfigurationSchema, ZodSchemaType} from '../../models/extensions/schemas.js'
import {ExtensionCategory} from '../../models/app/extensions.js'
import {FunctionConfigType} from '../../models/extensions/functions.js'
import {blocks} from '../../constants.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function fetchTemplateSpecifications(token: string): Promise<TemplateSpecification[]> {
  try {
    const result: RemoteTemplateSpecificationsQuerySchema = await partnersRequest(
      RemoteTemplateSpecificationsQuery,
      token,
    )
    return result.templateSpecifications.map(mapRemoteTemplateSpecification)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return []
  }
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
      const extensionCustoms = resolveExtensionCustoms(extension.type)
      return {
        identifier: extension.type,
        externalIdentifier: extension.type,
        externalName: extension.type,
        gated: false,
        registrationLimit: registrationLimit(extension.type),
        supportedFlavors: extension.supportedFlavors,
        group: remoteTemplateSpecification.group,
        category: () => extensionCustoms.category,
        configSchema: BaseFunctionConfigurationSchema,
        templateURL: remoteTemplateSpecification.url,
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

// There should be another api with the extensions specifications. Right now templates only support functions
function resolveExtensionCustoms(_type: string): {
  category: ExtensionCategory
  configSchema?: ZodSchemaType<FunctionConfigType>
} {
  return {
    category: 'function',
    configSchema: BaseFunctionConfigurationSchema,
  }
}

// There should be another api with the extensions specifications. Right now templates only support functions
function registrationLimit(identifier: string) {
  if (identifier === 'cart_transform') {
    return 1
  } else {
    return blocks.functions.defaultRegistrationLimit
  }
}
