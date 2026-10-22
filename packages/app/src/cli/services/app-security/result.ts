import {effectiveClientId, type AppSecuritySelection} from '../app-security-selection.js'
import {resolvePath} from '@shopify/cli-kit/node/path'
// eslint-disable-next-line no-restricted-imports -- JSON file paths use native platform separators.
import {resolve} from 'node:path'
import type {
  AppSecurityApp,
  AppSecurityBlocking,
  AppSecurityInstructions,
  AppSecurityScanDirectory,
  AppSecurityScope,
} from './types.js'
import type {AppSecurityBlockingLevel} from '../app-security-api.js'
import type {AppSecurityScope as StoredAppSecurityScope, CoverageScanDirectory} from '../app-security-engine/index.js'
import type {AppSecurityInstructionsDelivery} from '../app-security-instructions.js'

/**
 * The projections from the app security commands' data to the shared parts of their JSON output, in types.ts. Some
 * of that data has the stored results files' own format, from app-security-engine/results/schema.ts: the projections
 * convert it, so that format never appears in the public contract.
 */

const SCAN_DIRECTORY_ORIGINS: Record<CoverageScanDirectory['origin'], AppSecurityScanDirectory['origin']> = {
  app_directory: 'app-directory',
  include_dir: 'include-dir',
  app_config_directory: 'app-config-directory',
}

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
