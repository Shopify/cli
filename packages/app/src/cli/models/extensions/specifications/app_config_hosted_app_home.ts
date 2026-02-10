import {BaseSchemaWithoutHandle} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BuildStepsConfig} from '../../../services/build/build-steps.js'
import {zod} from '@shopify/cli-kit/node/schema'

const HostedAppHomeSchema = BaseSchemaWithoutHandle.extend({
  static_root: zod.string().optional(),
})

const HostedAppHomeTransformConfig: TransformationConfig = {
  static_root: 'static_root',
}

export const HostedAppHomeSpecIdentifier = 'hosted_app_home'

/**
 * Static build steps configuration for hosted_app_home.
 * Uses ConfigurableValue to reference the 'static_root' field from the TOML config.
 * This configuration is pure data (no functions) and can be serialized to/from JSON.
 *
 * When static_root is not configured in TOML, the configPath will resolve to undefined,
 * and the copy-files-step will handle it gracefully (skip with optional: true).
 */
const hostedAppHomeBuildSteps: BuildStepsConfig = {
  steps: [
    {
      id: 'copy-static-assets',
      displayName: 'Copy Static Assets',
      type: 'copy_files',
      config: {
        strategy: 'directory',
        // Reference to TOML config field - resolves to undefined if not configured
        // optional: true means skip silently if the field doesn't exist in TOML
        source: {configPath: 'static_root', optional: true},
      },
    },
  ],
  stopOnError: true,
}

const hostedAppHomeSpec = createConfigExtensionSpecification({
  identifier: HostedAppHomeSpecIdentifier,
  buildConfig: {
    mode: 'build_steps',
    stepsConfig: hostedAppHomeBuildSteps,
  },
  schema: HostedAppHomeSchema,
  transformConfig: HostedAppHomeTransformConfig,
})

export default hostedAppHomeSpec
