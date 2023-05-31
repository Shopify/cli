import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

export function buildChoices(templateSpecifications: string[]) {
  const templateSpecChoices = templateSpecifications.map((spec) => {
    return {
      label: spec,
      value: spec,
    }
  })
  return templateSpecChoices.sort((c1, c2) => c1.label.localeCompare(c2.label))
}

const migratePrompt = async (names: string[]): Promise<string> => {
  const name = await renderSelectPrompt({
    message: 'Choose extension to migrate',
    choices: buildChoices(names),
  })

  return name
}

export default migratePrompt
