import {
  ExtensionTypes,
  isUiExtensionType,
  isFunctionExtensionType,
  functionExtensionTemplates,
  extensionTypesGroups,
  functionExtensions,
  publicFunctionExtensions,
  getExtensionOutputConfig,
} from '../../constants.js'
import {getUIExtensionTemplates, isValidUIExtensionTemplate} from '../../utilities/extensions/template-configuration.js'
import {fetchExtensionSpecifications} from '../../utilities/extensions/fetch-extension-specifications.js'
import {fetchAppAndIdentifiers} from '../../services/environment.js'
import {AppInterface} from '../../models/app/app.js'
import {ui, environment, session} from '@shopify/cli-kit'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'

interface GenerateExtensionOptions {
  name?: string
  extensionType?: string
  extensionTypesAlreadyAtQuota: string[]
  extensionFlavor?: string
  directory: string
  app: AppInterface
  reset: boolean
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
  const token = await session.ensureAuthenticatedPartners()
  const [_partnersApp, envIdentifiers] = await fetchAppAndIdentifiers(options, token)
  const extensionSpecifications = await fetchExtensionSpecifications(token, envIdentifiers.app!)
  const supportedFunctionExtensions = isShopify ? functionExtensions.types : publicFunctionExtensions.types

  const supportedExtensions = [
    ...extensionSpecifications,
    ...supportedFunctionExtensions.map((extension) => {
      return {
        identifier: extension,
        externalName: getExtensionOutputConfig(extension).humanKey,
        options: {
          registrationLimit: 1,
        },
      }
    }),
  ]
  const localExtensions = [...options.app.extensions.ui, ...options.app.extensions.theme]

  if (!options.extensionType) {
    let relevantExtensionTypes = supportedExtensions.filter((specification) => {
      const localExtensionForType = localExtensions.filter((extension) => extension.type === specification.identifier)
      return localExtensionForType.length < specification.options.registrationLimit
    })

    if (options.extensionFlavor) {
      relevantExtensionTypes = relevantExtensionTypes.filter((relevantExtensionType) =>
        isValidUIExtensionTemplate(relevantExtensionType.identifier, options.extensionFlavor),
      )
    }

    questions.push({
      type: 'select',
      name: 'extensionType',
      message: 'Type of extension?',
      choices: relevantExtensionTypes
        .map((type) => {
          const choiceWithoutGroup = {
            name: type.externalName,
            value: type.identifier,
          }
          const group = extensionTypesGroups.find((group) => includes(group.extensions, type.identifier))
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
