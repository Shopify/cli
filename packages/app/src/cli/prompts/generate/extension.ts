import {
  extensions,
  ExtensionTypes,
  getExtensionOutputConfig,
  isUiExtensionType,
  isFunctionExtensionType,
  functionExtensionTemplates,
  extensionTypesGroups,
} from '../../constants.js'
import {getUIExtensionTemplates, isValidUIExtensionTemplate} from '../../utilities/extensions/template-configuration.js'
import {ui, environment} from '@shopify/cli-kit'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'

interface GenerateExtensionOptions {
  name?: string
  extensionType?: string
  extensionTypesAlreadyAtQuota: string[]
  extensionFlavor?: string
  directory: string
}

interface GenerateExtensionOutput {
  name: string
  extensionType: ExtensionTypes
  extensionFlavor?: string
}

export const extensionFlavorQuestion = (extensionType: string): ui.Question => {
  let choices: {name: string; value: string}[] = []
  if (isUiExtensionType(extensionType)) {
    choices = choices.concat(getUIExtensionTemplates(extensionType))
  }
  if (isFunctionExtensionType(extensionType)) {
    choices = choices.concat(functionExtensionTemplates)
  }
  return {
    type: 'select',
    name: 'extensionFlavor',
    message: 'What would you like to work in?',
    choices,
    default: 'react',
  }
}

const generateExtensionPrompt = async (
  options: GenerateExtensionOptions,
  prompt = ui.prompt,
): Promise<GenerateExtensionOutput> => {
  const questions: ui.Question<'name' | 'extensionType'>[] = []
  const isShopify = await environment.local.isShopify()
  const supportedExtensions = isShopify ? extensions.types : extensions.publicTypes
  if (!options.extensionType) {
    let relevantExtensionTypes = supportedExtensions.filter(
      (type) => !options.extensionTypesAlreadyAtQuota.includes(type),
    )
    if (options.extensionFlavor) {
      relevantExtensionTypes = relevantExtensionTypes.filter((relevantExtensionType) =>
        isValidUIExtensionTemplate(relevantExtensionType, options.extensionFlavor),
      )
    }
    questions.push({
      type: 'select',
      name: 'extensionType',
      message: 'Type of extension?',
      choices: relevantExtensionTypes
        .map((type) => {
          const choiceWithoutGroup = {
            name: getExtensionOutputConfig(type).humanKey,
            value: type,
          }
          const group = extensionTypesGroups.find((group) => includes(group.extensions, type))
          if (group) {
            return {
              ...choiceWithoutGroup,
              group: {
                name: group.name,
                order: extensionTypesGroups.indexOf(group),
              },
            }
          }
          return choiceWithoutGroup
        })
        .sort((c1, c2) => c1.name.localeCompare(c2.name)),
    })
  }
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: "Your extension's working name?",
      default: await generateRandomNameForSubdirectory({suffix: 'ext', directory: options.directory}),
    })
  }
  let promptOutput: GenerateExtensionOutput = await prompt(questions)
  const extensionType = {...options, ...promptOutput}.extensionType
  if (!options.extensionFlavor && (isUiExtensionType(extensionType) || isFunctionExtensionType(extensionType))) {
    promptOutput = {
      ...promptOutput,
      extensionFlavor: (
        (await prompt([
          extensionFlavorQuestion(extensionType),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ])) as any
      ).extensionFlavor,
    }
  }
  return {...options, ...promptOutput}
}

function includes<TNarrow extends TWide, TWide>(coll: ReadonlyArray<TNarrow>, el: TWide): el is TNarrow {
  return coll.includes(el as TNarrow)
}

export default generateExtensionPrompt
