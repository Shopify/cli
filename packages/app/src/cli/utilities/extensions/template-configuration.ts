import {GenericSpecification} from '../../models/app/extensions.js'
import {ExtensionSpec} from '../../models/extensions/extensions.js'

export function isValidUIExtensionTemplate(
  specification: GenericSpecification,
  uiExtensionTemplateValue?: string,
): boolean {
  if (specification.category() !== 'ui') return false
  const uiSpec = specification as ExtensionSpec

  return Boolean(uiSpec.supportedFlavors.find((flavor) => flavor.value === uiExtensionTemplateValue))
}
