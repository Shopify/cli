import {createUIExtensionSpecification} from '../ui.js'
import {defaultExtensionFlavors} from '../../../constants.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileSize} from '@shopify/cli-kit/node/fs'

const kilobytes = 1024
const BUNDLE_SIZE_LIMIT_KB = 128
const BUNDLE_SIZE_LIMIT = BUNDLE_SIZE_LIMIT_KB * kilobytes

const dependency = '@shopify/web-pixels-extension'

const WebPixelSchema = BaseUIExtensionSchema.extend({
  runtimeContext: zod.string(),
  version: zod.string().optional(),
  configuration: zod.any(),
  settings: zod.any(),
})

const spec = createUIExtensionSpecification({
  identifier: 'web_pixel_extension',
  surface: 'unknown',
  dependency,
  partnersWebIdentifier: 'web_pixel',
  supportedFlavors: defaultExtensionFlavors.filter((flavor) => !flavor.value.includes('react')),
  schema: WebPixelSchema,
  deployConfig: async (config, _) => {
    return {
      runtime_context: config.runtimeContext,
      runtime_configuration_definition: config.settings,
    }
  },
  buildValidation: async (extension) => {
    const bundleSize = await fileSize(extension.outputBundlePath)
    if (bundleSize > BUNDLE_SIZE_LIMIT) {
      const humanReadableBundleSize = `${(bundleSize / kilobytes).toFixed(2)} kB`
      throw new AbortError(
        `Your web pixel extension exceeds the total file size limit (${BUNDLE_SIZE_LIMIT_KB} kB). It's currently ${humanReadableBundleSize}.`,
        `Reduce your total file size and try again.`,
      )
    }
  },
  preDeployValidation: async (extension) => {
    if (extension.configuration.configuration) {
      throw new AbortError(
        `The property configuration is deprecated and no longer supported.`,
        `It has been replaced by settings.`,
      )
    }
    return Promise.resolve()
  },
  previewMessage: () => undefined,
  isPreviewable: false,
})

export default spec
