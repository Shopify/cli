import {FunctionConfigType} from './functions.js'
import {BaseFunctionConfigurationSchema, ZodSchemaType} from './schemas.js'
import {TemplateSpecification} from '../../api/graphql/template_specifications.js'
import {ExtensionCategory, GenericSpecification} from '../app/extensions.js'

export function getExtensionSpecificationsFromTemplates(
  templateSpecifications: TemplateSpecification[],
): GenericSpecification[] {
  return templateSpecifications.flatMap(getExtensionSpecificationsFromTemplate)
}

export function getExtensionSpecificationsFromTemplate(
  templateSpecification?: TemplateSpecification,
): GenericSpecification[] {
  if (!templateSpecification) return []
  return templateSpecification.types.map((extension) => {
    const extensionCustoms = resolveExtensionCustoms(extension.type)
    return {
      identifier: extension.type,
      externalIdentifier: extension.type,
      externalName: extension.type,
      gated: false,
      registrationLimit: 10,
      supportedFlavors: extension.supportedFlavors,
      group: templateSpecification.group,
      category: () => extensionCustoms.category,
      configSchema: BaseFunctionConfigurationSchema,
      templateURL: templateSpecification.url,
      helpURL: templateSpecification.supportLinks[0]!,
      templatePath: (flavor: string) => {
        const supportedFlavor = extension.supportedFlavors.find((supportedFlavor) => supportedFlavor.value === flavor)
        if (!supportedFlavor) return undefined
        return supportedFlavor.path
      },
    }
  })
}

function resolveExtensionCustoms(_type: string): {
  category: ExtensionCategory
  configSchema?: ZodSchemaType<FunctionConfigType>
} {
  // There should be another api with the extensions specifications. Right now templates only support functions
  return {
    category: 'function',
    configSchema: BaseFunctionConfigurationSchema,
  }
}
