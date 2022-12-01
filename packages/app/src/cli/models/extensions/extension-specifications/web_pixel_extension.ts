import {createUIExtensionSpec} from '../ui.js'
import {BaseExtensionSchema} from '../schemas.js'
import {defualtExtensionFlavors} from '../../../constants.js'
import {error, schema} from '@shopify/cli-kit'

const dependency = {name: '@shopify/web-pixels-extension', version: '^0.1.1'}

const WebPixelSchema = BaseExtensionSchema.extend({
  runtimeContext: schema.define.string(),
  version: schema.define.string().optional(),
  configuration: schema.define.any(),
  settings: schema.define.any(),
})

const spec = createUIExtensionSpec({
  identifier: 'web_pixel_extension',
  externalIdentifier: 'web_pixel',
  externalName: 'Web pixel',
  surface: 'unknown',
  dependency,
  partnersWebIdentifier: 'web_pixel',
  supportedFlavors: defualtExtensionFlavors.filter((flavor) => !flavor.value.includes('react')),
  schema: WebPixelSchema,
  deployConfig: async (config, _) => {
    return {
      runtime_context: config.runtimeContext,
      runtime_configuration_definition: config.settings,
    }
  },
  preDeployValidation: (config) => {
    if (config.configuration) {
      throw new error.Abort(
        `The property configuration is deprecated and no longer supported.`,
        `It has been replaced by settings.`,
      )
    }
    return Promise.resolve()
  },
  previewMessage: () => undefined,
})

export default spec
