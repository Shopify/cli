import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

function buildChoices(templateSpecifications: string[]) {
  const templateSpecChoices = templateSpecifications.map((spec) => {
    return {
      label: spec,
      value: spec,
    }
  })
  return templateSpecChoices.sort((c1, c2) => c1.label.localeCompare(c2.label))
}

export const importExtensionsPrompt = async (names: string[]): Promise<string> => {
  const name = await renderSelectPrompt({
    message: 'Extension to migrate',
    choices: buildChoices(names),
  })

  return name
}
