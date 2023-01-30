import {extensionTypesGroups} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {ui} from '@shopify/cli-kit'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'

interface GenerateExtensionOptions {
  name?: string
  extensionType?: string
  extensionFlavor?: string
  directory: string
  app: AppInterface
  extensionSpecifications: GenericSpecification[]
  reset: boolean
}

interface GenerateExtensionOutput {
  name: string
  extensionType: string
  extensionFlavor?: string
}

export const extensionFlavorQuestion = (specification: GenericSpecification): ui.Question => {
  return {
    type: 'select',
    name: 'extensionFlavor',
    message: 'What would you like to work in?',
    choices: specification.supportedFlavors,
    default: 'react',
  }
}

export function buildChoices(specifications: GenericSpecification[]) {
  return specifications
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
    .sort((c1, c2) => c1.name.localeCompare(c2.name))
}

const generateExtensionPrompt = async (
  options: GenerateExtensionOptions,
  prompt = ui.prompt,
): Promise<GenerateExtensionOutput> => {
  const questions: ui.Question<'name' | 'extensionType'>[] = []

  let allExtensions = options.extensionSpecifications

  if (!options.extensionType) {
    if (options.extensionFlavor) {
      const flavor = options.extensionFlavor
      allExtensions = allExtensions.filter((spec) => spec.supportedFlavors.map((elem) => elem.value).includes(flavor))
    }

    questions.push({
      type: 'select',
      name: 'extensionType',
      message: 'Type of extension?',
      choices: buildChoices(allExtensions),
    })
  }
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Extension name (internal only)',
      default: await generateRandomNameForSubdirectory({suffix: 'ext', directory: options.directory}),
    })
  }
  let promptOutput: GenerateExtensionOutput = await prompt(questions)
  const extensionType = {...options, ...promptOutput}.extensionType
  const specification = options.extensionSpecifications.find((spec) => spec.identifier === extensionType)!
  if (!options.extensionFlavor && specification.supportedFlavors.length > 1) {
    promptOutput = {
      ...promptOutput,
      extensionFlavor: (
        (await prompt([
          extensionFlavorQuestion(specification),
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
