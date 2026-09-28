/**
 * Whether a filesystem error means the path (or one of its ancestors) does not
 * exist, as opposed to existing but being unreadable.
 */
export function isMissingFilesystemEntry(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

/** A short, locale-independent reason for a failed filesystem inspection, carrying the error code when there is one. */
export function inspectErrorReason(target: string, error: unknown): string {
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined
  return code ? `Could not inspect ${target} (${code})` : `Could not inspect ${target}`
}
