import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema, NewExtensionPointSchemaType, NewExtensionPointsSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {configurationFileNames} from '../../../constants.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import * as output from '@shopify/cli-kit/node/output'
import {schema} from '@shopify/cli-kit/node/schema'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.22.0'}

const UIExtensionSchema = BaseUIExtensionSchema.extend({
  settings: schema
    .object({
      fields: schema.any().optional(),
    })
    .optional(),
  extensionPoints: NewExtensionPointsSchema,
})

const spec = createUIExtensionSpecification({
  identifier: 'ui_extension',
  externalIdentifier: 'ui_extension',
  externalName: 'UI Extension',
  surface: 'all',
  dependency,
  partnersWebIdentifier: 'checkout_ui_extension',
  singleEntryPath: false,
  schema: UIExtensionSchema,
  validate: async (config, directory) => {
    return validateUIExtensionPointConfig(directory, config.extensionPoints)
  },
  previewMessage(host, uuid, config, storeFqdn) {
    const links = config.extensionPoints.map(
      ({target}) => `${target} preview link: ${host}/extensions/${uuid}/${target}`,
    )
    return output.content`${links.join('\n')}`
  },
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extensionPoints,
      capabilities: config.capabilities,
      name: config.name,
      settings: config.settings,
      localization: await loadLocalesConfig(directory, config.type),
    }
  },
  getBundleExtensionStdinContent: (config) => {
    return config.extensionPoints.map(({module}) => `import '${module}';`).join('\n')
  },
  shouldFetchCartUrl: (config) => {
    return (
      config.extensionPoints.find((extensionPoint) => {
        return getExtensionPointTargetSurface(extensionPoint.target) === 'checkout'
      }) !== undefined
    )
  },
  hasExtensionPointTarget: (config, requestedTarget) => {
    return (
      config.extensionPoints.find((extensionPoint) => {
        return extensionPoint.target === requestedTarget
      }) !== undefined
    )
  },
})

async function validateUIExtensionPointConfig(
  directory: string,
  extensionPoints: NewExtensionPointSchemaType[],
): Promise<Result<unknown, string>> {
  const errors: string[] = []
  const uniqueTargets: string[] = []
  const duplicateTargets: string[] = []

  for await (const {module, target} of extensionPoints) {
    const fullPath = joinPath(directory, module)
    const exists = await fileExists(fullPath)

    if (!exists) {
      const notFoundPath = output.token.path(joinPath(directory, module))

      errors.push(
        output.content`Couldn't find ${notFoundPath}
Please check the module path for ${target}`.value,
      )
    }

    if (uniqueTargets.indexOf(target) === -1) {
      uniqueTargets.push(target)
    } else {
      duplicateTargets.push(target)
    }
  }

  if (duplicateTargets.length) {
    errors.push(`Duplicate targets found: ${duplicateTargets.join(', ')}\nExtension point targets must be unique`)
  }

  if (errors.length) {
    const tomlPath = joinPath(directory, configurationFileNames.extension.ui)

    errors.push(`Please check the configuration in ${tomlPath}`)
    return err(errors.join('\n\n'))
  }
  return ok({})
}

export default spec
