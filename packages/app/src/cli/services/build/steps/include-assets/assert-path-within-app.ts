import {relativePath, isAbsolutePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Throws if `resolvedPath` is not inside `appDirectory`.
 *
 * Guards against accidental misuse where an extension config points an asset
 * source outside the app folder (e.g. `source = "../../"` or an absolute home
 * directory path). Adversarial bypass via symlinks is out of scope — server-side
 * size enforcement is the real boundary; this check is a fast-fail for DX.
 *
 * `configValue` is the raw value from configuration used in the error message
 * so the user can locate the offending entry.
 */
export function assertPathWithinAppDir(resolvedPath: string, appDirectory: string, configValue: string): void {
  const relative = relativePath(appDirectory, resolvedPath)
  if (relative.startsWith('..') || isAbsolutePath(relative)) {
    throw new AbortError(
      `Asset path '${configValue}' resolves outside the app directory.`,
      `Asset sources must be inside the app folder. Resolved to: ${resolvedPath}`,
    )
  }
}
