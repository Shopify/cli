/**
 * Review-scope and metadata-inventory contract.
 *
 * Review scopes select directories for generating agent instructions; the
 * inventory reports which scopes exist now and which retained results refer to.
 * Neither is scan-discovery authority: nothing here authorises reading files.
 */
import type {AppDoctorResultOwner} from '../results/index.js'
import type {AppDoctorPathReference, AppDoctorScopeDescriptor} from '../results/scope.js'

export type AppDoctorScopeErrorCode =
  | 'INVALID_PATH'
  | 'NO_REVIEW_DIRECTORIES'
  | 'INVALID_REVIEW_DIRECTORY'
  | 'REVIEW_DIRECTORY_NOT_FOUND'
  | 'REVIEW_DIRECTORY_NOT_A_DIRECTORY'
  | 'IO_ERROR'
  | 'DESCRIPTOR_INVALID'
  | 'FOREIGN_CONFIGURATION'

/**
 * Raised when review scopes or the inventory cannot be built.
 *
 * A plain `Error` rather than a cli-kit `AbortError`: the engine is a library
 * boundary and callers decide how to surface failures. Messages may mention
 * paths but never file contents.
 */
export class AppDoctorScopeError extends Error {
  constructor(
    readonly code: AppDoctorScopeErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppDoctorScopeError'
  }
}

/** One directory selected for agent review, with the descriptor results produced for it will carry. */
export interface AppDoctorReviewScope {
  readonly scopeIdentity: string
  /**
   * Canonical absolute directory: realpath'd, normalized, and then canonical in
   * the `canonicalLocation` sense (root casing, separators, no trailing separator).
   * Local and private; never serialised into a result.
   */
  readonly directory: string
  /** Every spelling the caller used for this directory, in request order, for presentation only. */
  readonly requestedPaths: ReadonlyArray<string>
  readonly descriptor: AppDoctorScopeDescriptor
  readonly isAppRoot: boolean
}

/** A scope that exists for the selected configuration in this invocation. */
export interface AppDoctorCurrentScope {
  readonly scopeIdentity: string
  /** Canonical absolute directory. Local and private; never serialised into a result. */
  readonly directory: string
  readonly reference: AppDoctorPathReference
  readonly selection: 'implicit_app'
}

/**
 * What one retained result says about its scope, reported as data. The
 * descriptor is never resolved against the filesystem and duplicates are kept.
 */
export interface AppDoctorRetainedScopeObservation {
  readonly owner: AppDoctorResultOwner
  readonly descriptor: AppDoctorScopeDescriptor
  readonly producedAt: string
  readonly selection: 'retained_only'
  /** True when some current scope shares this observation's scope identity. */
  readonly matchesCurrent: boolean
}

export interface AppDoctorMetadataInventory {
  readonly current: ReadonlyArray<AppDoctorCurrentScope>
  readonly retained: ReadonlyArray<AppDoctorRetainedScopeObservation>
}
