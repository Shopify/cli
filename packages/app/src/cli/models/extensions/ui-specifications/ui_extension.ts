import {createUIExtensionSpec} from '../ui.js'
import {BaseUIExtensionSchema, NewExtensionPointSchemaType, NewExtensionPointsSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {configurationFileNames} from '../../../constants.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import {file, output, path, schema} from '@shopify/cli-kit'
import {err, ok, Result} from '@shopify/cli-kit/node/result'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.20.0'}

const UIExtensionSchema = BaseUIExtensionSchema.extend({
  settings: schema.define.string().optional(),
  extensionPoints: NewExtensionPointsSchema,
})

const spec = createUIExtensionSpec({
  identifier: 'ui_extension',
  externalIdentifier: 'ui_extension',
  externalName: 'UI Extension',
  surface: 'checkout',
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
      metafields: config.metafields,
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
    const fullPath = path.join(directory, module)
    const fileExists = await file.exists(fullPath)

    if (!fileExists) {
      const notFoundPath = output.token.path(path.join(directory, module))

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
    const tomlPath = path.join(directory, configurationFileNames.extension.ui)

    errors.push(`Please check the configuration in ${tomlPath}`)
    return err(errors.join('\n\n'))
  }
  return ok({})
}

export default spec
