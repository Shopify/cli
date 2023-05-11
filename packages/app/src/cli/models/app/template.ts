import {ExtensionFlavor} from './extensions.js'

export interface TemplateType {
  type: string
  extensionPoints: string[]
  supportedFlavors: ExtensionFlavor[]
  url: string
}

export interface TemplateSpecification {
  identifier: string
  name: string
  group: string
  supportLinks: string[]
  types: TemplateType[]
}

export function getTypesExternalName(templates: TemplateSpecification[]): string[] {
  return templates.flatMap((template) => template.name)
}
