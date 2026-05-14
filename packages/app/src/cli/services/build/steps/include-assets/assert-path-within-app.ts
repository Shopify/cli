import {relativePath, isAbsolutePath} from '@shopify/cli-kit/node/path'
import {fileRealPath} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Throws if `resolvedPath` is not inside `appDirectory` after symlink resolution.
 *
 * Guards against accidental misuse where an extension config points an asset
 * source outside the app folder — either via `..`/absolute paths or by
 * symlinking an in-app directory to somewhere else (e.g. a home directory).
 *
 * Both sides are realpath'd before comparison so macOS temp paths
 * (`/var/folders` → `/private/var/folders`) and pnpm-style in-tree symlinks
 * don't trip a false positive.
 *
 * `configValue` is the raw value from configuration used in the error message
 * so the user can locate the offending entry. Caller must ensure `resolvedPath`
 * exists on disk — `fileRealPath` throws on missing paths.
 */
export async function assertPathWithinAppDir(
  resolvedPath: string,
  appDirectory: string,
  configValue: string,
): Promise<void> {
  const [realSource, realAppDir] = await Promise.all([fileRealPath(resolvedPath), fileRealPath(appDirectory)])
  const relative = relativePath(realAppDir, realSource)
  // Check `..` as a path segment, not just a prefix. A sibling-style name like
  // `..cache` is a valid in-app entry whose relative path begins with `..` but
  // does not escape.
  const firstSegment = relative.split(/[/\\]/, 1)[0]
  if (firstSegment === '..' || isAbsolutePath(relative)) {
    throw new AbortError(
      `Asset path '${configValue}' resolves outside the app directory.`,
      `Asset sources must be inside the app folder. Resolved to: ${realSource}`,
    )
  }
}
