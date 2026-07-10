import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, CapabilitiesSchema} from '../schemas.js'
import {ExtensionInstance} from '../extension-instance.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/retail-ui-extensions'

// POS-specific capabilities. Extends the shared capabilities (block_progress, etc.)
// with an `intercepts` array listing the host-mediated events this extension may
// block. Membership in the array is the event-scoped POS analogue of checkout's
// single `block_progress` capability boolean. Do not fold `intercepts` into the
// shared CapabilitiesSchema — it is POS-only.
//
// Event names are intentionally free-form strings (not a hardcoded enum): they are
// functionally equivalent to extension targets, and the server is the source of
// truth for the valid set. This keeps the event set forward-compatible — new
// intercept events can ship without a CLI release and won't be rejected by older
// CLI installs. Only light structural validation happens here (lowercase letters
// a-z + uniqueness); the backend validates the actual event names at deploy.
const PosCapabilitiesSchema = CapabilitiesSchema.extend({
  intercepts: zod
    .array(
      zod.string().regex(/^[a-z]+$/, {
        message: 'Intercept event must contain only lowercase letters (a-z)',
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
