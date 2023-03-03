import {extensionTypesGroups} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {outputWarn} from '@shopify/cli-kit/node/output'

interface GenerateExtensionOptions {
  name?: string
  extensionType?: string
  extensionFlavor?: string
  directory: string
  app: AppInterface
  extensionSpecifications: GenericSpecification[]
  unavailableExtensions: string[]
  reset: boolean
}

interface GenerateExtensionOutput {
  name: string
  extensionType: string
  extensionFlavor?: string
}

export function buildChoices(specifications: GenericSpecification[]) {
  return specifications
    .map((type) => {
      const choiceWithoutGroup = {
        label: type.externalName,
        value: type.identifier,
      }
      const group = extensionTypesGroups.find((group) => includes(group.extensions, type.identifier))
      if (group) {
        return {
          ...choiceWithoutGroup,
          group: group.name,
        }
      }
      return choiceWithoutGroup
    })
    .sort((c1, c2) => c1.label.localeCompare(c2.label))
}

const generateExtensionPrompt = async (options: GenerateExtensionOptions): Promise<GenerateExtensionOutput> => {
  let allExtensions = options.extensionSpecifications
  let extensionType = options.extensionType
  let name = options.name
  let extensionFlavor = options.extensionFlavor

  if (!extensionType) {
    if (extensionFlavor) {
      allExtensions = allExtensions.filter((spec) =>
        spec.supportedFlavors.map((elem) => elem.value as string).includes(extensionFlavor!),
      )
    }

    if (options.unavailableExtensions.length > 0) {
      outputWarn(
        `You've reached the limit for these types of extensions: ${options.unavailableExtensions.join(', ')}\n`,
      )
    }
    // eslint-disable-next-line require-atomic-updates
    extensionType = await renderSelectPrompt({
      message: 'Type of extension?',
      choices: buildChoices(allExtensions),
    })
  }
  if (!name) {
    name = await renderTextPrompt({
      message: 'Extension name (internal only)',
      defaultValue: await generateRandomNameForSubdirectory({suffix: 'ext', directory: options.directory}),
    })
  }
  const specification = options.extensionSpecifications.find((spec) => spec.identifier === extensionType)!
  if (!extensionFlavor && specification.supportedFlavors.length > 1) {
    // eslint-disable-next-line require-atomic-updates
    extensionFlavor = await renderSelectPrompt({
      message: 'What would you like to work in?',
      choices: specification.supportedFlavors.map((flavor) => {
        return {
          label: flavor.name,
          value: flavor.value,
        }
      }),
      defaultValue: 'react',
    })
  }
  return {...options, name, extensionType, extensionFlavor}
}

function includes<TNarrow extends TWide, TWide>(coll: ReadonlyArray<TNarrow>, el: TWide): el is TNarrow {
  return coll.includes(el as TNarrow)
}

export default generateExtensionPrompt
