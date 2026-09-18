import {AppDoctorContextError} from './types.js'

/**
 * Shared classification of Node filesystem errors for the modules that touch
 * disk: the context modules (discovery, storage, context composition) and the
 * scopes modules (review-directory resolution).
 */

/** The `code` of a Node system error (`ENOENT`, `EACCES`, ...), if present. */
export const systemErrorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined

/** True when a path (or one of its parent components) does not exist. */
export const isMissingPathError = (error: unknown) =>
  systemErrorCode(error) === 'ENOENT' || systemErrorCode(error) === 'ENOTDIR'

/** Wrap an unexpected filesystem failure. Only the path and error code are exposed, never contents. */
export const ioError = (action: string, path: string, error: unknown) =>
  new AppDoctorContextError('IO_ERROR', `Couldn't ${action} ${path} (${systemErrorCode(error) ?? 'unknown'}).`)
