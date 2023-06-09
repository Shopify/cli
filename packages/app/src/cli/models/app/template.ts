import {ExtensionFlavorValue} from '../../services/generate/extension.js'

export interface ExtensionFlavor {
  name: string
  value: ExtensionFlavorValue
  path?: string
}

export interface TemplateType {
  type: string
  extensionPoints: string[]
  supportedFlavors: ExtensionFlavor[]
  url: string
}

export interface ExtensionTemplate {
  identifier: string
  name: string
  group: string
  supportLinks: string[]
  types: TemplateType[]
}

export function getTypesExternalName(templates: ExtensionTemplate[]): string[] {
  return templates.flatMap((template) => template.name)
}
