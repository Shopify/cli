import {ExtensionFlavorValue} from '../../services/generate/extension.js'

export interface ExtensionFlavor {
  name: string
  value: ExtensionFlavorValue
  path?: string
}

export interface ExtensionTemplate {
  identifier: string
  name: string
  defaultName: string
  sortPriority?: number
  group: string
  supportLinks: string[]
  type: string
  extensionPoints: string[]
  supportedFlavors: ExtensionFlavor[]
  url: string
}

export interface ExtensionTemplatesResult {
  templates: ExtensionTemplate[]
  groupOrder: string[]
}
