import {effectiveClientId, type AppSecuritySelection} from './app-security-selection.js'
import {isAbsolutePath, resolvePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
// eslint-disable-next-line no-restricted-imports -- JSON file paths use native platform separators.
import {resolve} from 'node:path'
import type {AppSecurityBlockingLevel} from './app-security-api.js'
import type {AppSecurityScope as StoredAppSecurityScope, CoverageScanDirectory} from './app-security-engine/index.js'
import type {AppSecurityInstructionsDelivery} from './app-security-instructions.js'

/**
 * The parts of the app security commands' JSON output that several commands share, and the codecs that map the
 * commands' data to them. This is the public contract: the stored results files have their own format, in
 * app-security-engine/results/schema.ts, and never appear in it.
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

type AppSecurityApp = zod.infer<typeof appSecurityAppSchema>

/** The coding-agent instructions, which a JSON result includes instead of printing them. */
export const appSecurityInstructionsSchema = zod
  .object({
    content: zod.string().min(1).describe('The instructions in Markdown, as printed without --json.'),
    copied: zod.boolean().describe('Whether the instructions were also copied to the clipboard.'),
  })
  .strict()

type AppSecurityInstructions = zod.infer<typeof appSecurityInstructionsSchema>

export const appSecurityScopeSchema = zod
  .object({
    includeDirs: zod.array(zod.string()).describe('The --include-dir values.'),
    excludes: zod.array(zod.string()).describe('The --exclude globs.'),
    noGitIgnore: zod.boolean().describe('Whether --no-git-ignore was passed.'),
  })
  .strict()
  .describe('The check flags that chose which files were gathered, exactly as typed.')

type AppSecurityScope = zod.infer<typeof appSecurityScopeSchema>

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

type AppSecurityScanDirectory = zod.infer<typeof appSecurityScanDirectorySchema>

const SCAN_DIRECTORY_ORIGINS: Record<CoverageScanDirectory['origin'], AppSecurityScanDirectory['origin']> = {
  app_directory: 'app-directory',
  include_dir: 'include-dir',
  app_config_directory: 'app-config-directory',
}

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

type AppSecurityBlocking = zod.infer<typeof appSecurityBlockingSchema>

/** CLI Kit joins paths with forward slashes, even on Windows. JSON output shows them absolute, with native separators. */
export function projectAppSecurityPath(path: string): string {
  return resolve(path)
}

/** Projects a path that is relative to the app directory, as results files record them. An absolute path stays as it is. */
export function projectAppSecurityRelativePath(appDirectory: string, path: string): string {
  return projectAppSecurityPath(resolvePath(appDirectory, path))
}

export function projectAppSecurityApp(selection: AppSecuritySelection): AppSecurityApp {
  return {
    directory: projectAppSecurityPath(selection.appDirectory),
    configurationPath: selection.kind === 'config' ? projectAppSecurityPath(selection.appConfigFilePath) : null,
    clientId: effectiveClientId(selection) ?? null,
  }
}

/** Projects delivered instructions: `delivery.copy` means that they're on the clipboard. */
export function projectAppSecurityInstructions(
  instructions: string,
  delivery: AppSecurityInstructionsDelivery,
): AppSecurityInstructions {
  return {content: instructions, copied: delivery.copy}
}

export function projectAppSecurityScope(scope: StoredAppSecurityScope): AppSecurityScope {
  return {includeDirs: scope.include_dirs, excludes: scope.excludes, noGitIgnore: scope.no_git_ignore}
}

/** Projects a scan directory, either absolute or relative to the app directory as results files record them. */
export function projectAppSecurityScanDirectory(
  appDirectory: string,
  scanDirectory: CoverageScanDirectory,
): AppSecurityScanDirectory {
  return {
    directory: projectAppSecurityRelativePath(appDirectory, scanDirectory.directory),
    origin: SCAN_DIRECTORY_ORIGINS[scanDirectory.origin],
  }
}

export function projectAppSecurityBlocking(blocking: {
  level: AppSecurityBlockingLevel
  blockedChecks: number
}): AppSecurityBlocking {
  return {level: blocking.level, blockedCheckCount: blocking.blockedChecks}
}
