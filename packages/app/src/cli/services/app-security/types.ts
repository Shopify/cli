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
      .describe(
        "The number of checks with an active finding and a severity at or above that level. Suppressed and superseded findings don't count. Always 0 for none.",
      ),
  })
  .strict()
  .describe('The --blocking policy and the checks that fail it.')

export type AppSecurityBlocking = zod.infer<typeof appSecurityBlockingSchema>

/**
 * The kind of an entry of shopify.app-security.json, spelled as in the file, so that the file and the JSON output use
 * the same values. A function, so each field gets its own instance.
 */
export const createAppSecuritySuppressionKindSchema = () =>
  zod
    .enum(['false-positive', 'accepted-risk'])
    .describe(
      "Why the finding is suppressed, as the entry's kind: false-positive, when the finding is a false positive, or accepted-risk, when the team accepts the risk.",
    )

export const appSecuritySuppressionEntrySchema = zod
  .object({
    index: zod.number().int().nonnegative().describe("The entry's index in the file's suppressions array, from 0."),
    source: zod.enum(['deterministic', 'agent']).describe('The source whose findings the entry suppresses.'),
    check: zod.string().describe('The check ID that the entry names.'),
    kind: createAppSecuritySuppressionKindSchema(),
    path: createAbsolutePathSchema().describe('The absolute path of the file that the entry names.'),
    status: zod
      .enum(['matched', 'stale', 'ambiguous', 'not-evaluated'])
      .describe(
        "How the entry applied: matched, when it matched at least one finding; stale, when it matched nothing although its source's executed result for the check could hold the finding; ambiguous, when its code matched more than one finding, so it suppresses none; or not-evaluated, when the results can't hold the finding, because the entry names other app configurations or its source has no executed result for the check.",
      ),
    matchedFindingCount: zod
      .number()
      .int()
      .nonnegative()
      .describe(
        'The number of findings that the entry matched. Each one is suppressed, apart from a deterministic finding that a prefer-agent agent result supersedes.',
      ),
  })
  .strict()
  .describe('One entry of shopify.app-security.json, and how it applied to the results.')

export const appSecuritySuppressionsSchema = zod
  .object({
    filePath: createAbsolutePathSchema().describe(
      'The absolute path of shopify.app-security.json in the app directory, whether or not the file exists.',
    ),
    entryCount: zod
      .number()
      .int()
      .nonnegative()
      .describe('The number of entries in the file, or 0 when the file does not exist.'),
    suppressedFindingCount: zod
      .number()
      .int()
      .nonnegative()
      .describe(
        'The number of findings that entries of the file suppress. Findings that only the agent suppressed are not counted.',
      ),
    entries: zod
      .array(appSecuritySuppressionEntrySchema)
      .describe('One result for each entry, in file order. Empty when the file does not exist.'),
  })
  .strict()
  .describe(
    'The suppressions file, shopify.app-security.json, and how its entries applied to the results. With review, the entries and the count cover every check, whatever --check-id selects.',
  )

export type AppSecuritySuppressions = zod.infer<typeof appSecuritySuppressionsSchema>
