import {getDependencyVersion} from '../../app/app.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, CapabilitiesSchema} from '../schemas.js'
import {ExtensionInstance} from '../extension-instance.js'
import {deriveInterceptsFromDirectory} from './pos_intercept_detection.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'

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

type PosCapabilities = zod.infer<typeof PosCapabilitiesSchema>

/**
 * SPIKE: derive intercept events from the extension source and merge them into
 * the capabilities object emitted at deploy time.
 *
 * The derived events are unioned with any hand-authored `capabilities.intercepts`
 * so both the derivation-first and the TOML-declaration workflows produce the
 * same shape. Unresolved (dynamic) event args are logged as a warning — they are
 * a known reliability gap and are never silently dropped.
 *
 * Detection failures are non-fatal: we fall back to whatever the TOML declared
 * so a source-parsing edge case can never block a deploy.
 */
export async function deriveAndMergeIntercepts(
  capabilities: PosCapabilities | undefined,
  directory: string,
): Promise<PosCapabilities | undefined> {
  let derivedEvents: string[] = []
  try {
    const detection = await deriveInterceptsFromDirectory(directory)
    if (detection) {
      derivedEvents = detection.events
      if (detection.unresolved.length > 0) {
        const locations = detection.unresolved
          .map((callsite) => `${callsite.file}:${callsite.line} (${callsite.argText || '<no arg>'})`)
          .join(', ')
        outputWarn(
          `POS intercept detection could not statically resolve ${detection.unresolved.length} intercept event(s): ${locations}. ` +
            `Declare these explicitly under capabilities.intercepts if the host must know about them.`,
        )
      }
      outputDebug(`Derived POS intercept events from source: ${derivedEvents.join(', ') || '(none)'}`)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputWarn(`POS intercept source detection failed; falling back to declared capabilities.intercepts. ${error}`)
  }

  const declaredEvents = capabilities?.intercepts ?? []
  const mergedEvents = [...new Set([...declaredEvents, ...derivedEvents])].sort()

  if (mergedEvents.length === 0) return capabilities
  return {...capabilities, intercepts: mergedEvents}
}

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

    // Derive intercept events from the extension's SOURCE CODE (control-flow
    // agnostic AST walk of the import graph) and fold them into
    // `capabilities.intercepts`. This is the transmission mechanism for derived
    // events: there is no dedicated wire field. deployConfig emits the SAME
    // `capabilities.intercepts` array the backend already reads — whether an
    // event came from the TOML or from source, it lands in the deployed version
    // config identically, so the backend persists it as a capability with no
    // backend change required. Derived + TOML-declared events are unioned so a
    // hand-authored declaration keeps working alongside derivation.
    const capabilities = await deriveAndMergeIntercepts(config.capabilities, directory)

    return {
      name: config.name,
      description: config.description,
      renderer_version: result?.version,
      capabilities,
    }
  },
})

export default posUISpec
