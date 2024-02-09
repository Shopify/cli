import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileSize} from '@shopify/cli-kit/node/fs'

const kilobytes = 1024
const BUNDLE_SIZE_LIMIT_KB = 128
const BUNDLE_SIZE_LIMIT = BUNDLE_SIZE_LIMIT_KB * kilobytes

const dependency = '@shopify/web-pixels-extension'

const WebPixelSchema = BaseSchema.extend({
  runtime_context: zod.string(),
  version: zod.string().optional(),
  configuration: zod.any(),
  customer_privacy: zod
    .object({
      analytics: zod.boolean(),
      preferences: zod.boolean(),
      marketing: zod.boolean(),
      sale_of_data: zod.enum(['enabled', 'disabled', 'ldu']),
    })
    .optional(),
  settings: zod.any(),
})

const spec = createExtensionSpecification({
  identifier: 'web_pixel_extension',
  dependency,
  partnersWebIdentifier: 'web_pixel',
  schema: WebPixelSchema,
  appModuleFeatures: (_) => ['bundling', 'esbuild', 'single_js_entry_path'],
  deployConfig: async (config, _) => {
    return {
      runtime_context: config.runtime_context,
      customer_privacy: config.customer_privacy,
      runtime_configuration_definition: config.settings,
    }
  },
  buildValidation: async (extension) => {
    const bundleSize = await fileSize(extension.outputPath)
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
})

export default spec
