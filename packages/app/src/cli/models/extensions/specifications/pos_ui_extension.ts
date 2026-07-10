import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, CapabilitiesSchema} from '../schemas.js'
import {ExtensionInstance} from '../extension-instance.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/retail-ui-extensions'

// The host-mediated intercept events a POS UI extension may block. Surface-augmented
// and expected to grow — add new events here as POS exposes more interceptable
// workflows. See `shopify.intercept()` in ui-api-design.
export const POS_INTERCEPT_EVENTS = ['beforecheckout', 'beforepayment'] as const

// POS-specific capabilities. Extends the shared capabilities (block_progress, etc.)
// with an `intercepts` array listing the events this extension may block. Membership
// in the array is the event-scoped POS analogue of checkout's single `block_progress`
// capability boolean. Do not fold `intercepts` into the shared CapabilitiesSchema —
// it is POS-only.
const PosCapabilitiesSchema = CapabilitiesSchema.extend({
  intercepts: zod
    .array(
      zod.enum(POS_INTERCEPT_EVENTS, {
        errorMap: () => ({
          message: `Intercept event must be one of: ${POS_INTERCEPT_EVENTS.join(', ')}`,
        }),
      }),
    )
    .optional()
    .superRefine((events, ctx) => {
      if (!events) return
      const duplicates = [...new Set(events.filter((event, index) => events.indexOf(event) !== index))]
      if (duplicates.length > 0) {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message: `Duplicate intercept events found: ${duplicates.join(
            ', ',
          )}. Each intercept event may only be declared once.`,
        })
      }
    }),
})

type PosUIConfigType = zod.infer<typeof PosUISchema>
const PosUISchema = BaseSchema.extend({
  name: zod.string(),
  capabilities: PosCapabilitiesSchema.optional(),
})

const posUISpec = createExtensionSpecification({
  identifier: 'pos_ui_extension',
  dependency,
  schema: PosUISchema,
  appModuleFeatures: (_) => ['ui_preview', 'esbuild', 'single_js_entry_path'],
  getOutputRelativePath: (extension: ExtensionInstance<PosUIConfigType>) => `dist/${extension.handle}.js`,
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [{id: 'bundle-ui', name: 'Bundle UI Extension', type: 'bundle_ui', config: {}}],
    },
  ],
  deployConfig: async (config, directory) => {
    const result = await getDependencyVersion(dependency, directory)
    if (result === 'not_found') throw new BugError(`Dependency ${dependency} not found`)
    return {
      name: config.name,
      description: config.description,
      renderer_version: result?.version,
      capabilities: config.capabilities,
    }
  },
})

export default posUISpec
