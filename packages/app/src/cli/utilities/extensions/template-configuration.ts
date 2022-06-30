import {isUiExtensionType, uiExtensionTemplates} from '../../constants.js'

export function getUIExtensionTemplates(extensionType: string): {name: string; value: string}[] {
  const filteredFlavors: string[] = []
  if (extensionType === 'web_pixel_extension') {
    filteredFlavors.push('react')
  }
  return uiExtensionTemplates.filter((template) => !filteredFlavors.includes(template.value))
}

export function isValidUIExtensionTemplate(extensionType: string, uiExtensionTemplateValue?: string): boolean {
  return (
    isUiExtensionType(extensionType) &&
    Boolean(
      getUIExtensionTemplates(extensionType).find(
        (extensionTemplate) => extensionTemplate.value === uiExtensionTemplateValue,
      ),
    )
  )
}
