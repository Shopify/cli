export function isMissingFilesystemEntry(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

export function inspectErrorReason(target: string, error: unknown): string {
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined
  return code ? `Could not inspect ${target} (${code})` : `Could not inspect ${target}`
}
