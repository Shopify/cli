import {extensionTypesGroups} from '../../constants.js'
import {ExtensionSpecification} from '../extensions/specification.js'

export interface TemplateSpecification {
  identifier: string
  name: string
  group: string
  supportLinks: string[]
  types: ExtensionSpecification[]
}

export function convertSpecificationsToTemplate(specifications: ExtensionSpecification[]): TemplateSpecification[] {
  return specifications.map((spec) => {
    return {
      identifier: spec.identifier,
      name: spec.externalName,
      group: spec.group || extensionTypesGroups.find((group) => group.extensions.includes(spec.identifier))?.name || '',
      supportLinks: spec.helpURL ? [spec.helpURL] : [],
      types: [spec],
    }
  })
}

export function getTypesExternalIdentitifier(templates: TemplateSpecification[]): string[] {
  return templates.flatMap((template) => template.types.map((type) => type.externalIdentifier))
}

export function getTypesExternalName(templates: TemplateSpecification[]): string[] {
  return templates.flatMap((template) => template.types.map((type) => type.externalName))
}
