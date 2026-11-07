import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

/**
 * The parts of the app security commands' JSON output that several commands share. This is the public contract: the
 * stored results files have their own format, in app-security-engine/results/schema.ts, and never appear in it.
 */

/**
 * An absolute path with the platform's native separators. A function, so each field gets its own instance: the JSON
 * Schema would render a shared instance as a `$ref` into the first field that uses it.
 */
export const createAbsolutePathSchema = () =>
  zod.string().refine(isAbsolutePath, 'Expected an absolute native filesystem path')

/** The app the command worked on. */
export const appSecurityAppSchema = zod
  .object({
    directory: createAbsolutePathSchema().describe('The absolute app directory.'),
    configurationPath: createAbsolutePathSchema()
      .nullable()
      .describe('The absolute path of the selected app configuration file, or null with --without-app-config.'),
    clientId: zod
      .string()
      .min(1)
      .nullable()
      .describe(
        "The --client-id value when passed, otherwise the app configuration's client_id. Null when the app configuration isn't linked.",
      ),
  })
  .strict()

export type AppSecurityApp = zod.infer<typeof appSecurityAppSchema>

/** The coding-agent instructions, which a JSON result includes instead of printing them. */
export const appSecurityInstructionsSchema = zod
  .object({
    content: zod.string().min(1).describe('The instructions in Markdown, as printed without --json.'),
    copied: zod.boolean().describe('Whether the instructions were also copied to the clipboard.'),
  })
  .strict()

export type AppSecurityInstructions = zod.infer<typeof appSecurityInstructionsSchema>

export const appSecurityScopeSchema = zod
  .object({
    includeDirs: zod.array(zod.string()).describe('The --include-dir values.'),
    excludes: zod.array(zod.string()).describe('The --exclude globs.'),
    noGitIgnore: zod.boolean().describe('Whether --no-git-ignore was passed.'),
  })
  .strict()
  .describe('The check flags that chose which files were gathered, exactly as typed.')

export type AppSecurityScope = zod.infer<typeof appSecurityScopeSchema>

export const appSecurityScanDirectorySchema = zod
  .object({
    directory: createAbsolutePathSchema().describe('The absolute path of the directory.'),
    origin: zod
      .enum(['app-directory', 'include-dir', 'app-config-directory'])
      .describe(
        'Why it was scanned: it is the app directory, an --include-dir value, or an extension or web directory of the app configuration.',
      ),
  })
  .strict()
  .describe('A directory that check scanned.')

export type AppSecurityScanDirectory = zod.infer<typeof appSecurityScanDirectorySchema>

export const appSecurityBlockingSchema = zod
  .object({
    level: zod.enum(['high', 'medium', 'low', 'none']).describe('The --blocking severity.'),
    blockedCheckCount: zod
      .number()
      .int()
      .nonnegative()
      .describe('The number of checks with findings at or above that severity. Always 0 for none.'),
  })
  .strict()
  .describe('The --blocking policy and the checks that fail it.')

export type AppSecurityBlocking = zod.infer<typeof appSecurityBlockingSchema>
