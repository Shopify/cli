/**
 * Public contract of the complete-result store.
 *
 * Every operation returns a discriminated outcome; the store never throws for
 * filesystem, ownership, or content problems. Consumers never supply paths:
 * everything derives from the context's storage anchor, store directory, and
 * configuration identity.
 */
import type {AppDoctorResult} from '../results/index.js'
import type {Suppression} from '../types.js'

export type AppDoctorWriterMode = 'static' | 'agent'

/**
 * Owner tuple of one stored result; the configuration comes from the context.
 * Names the file `results/<scope32>.<CHECK_ID>.<mode>.json` under the store
 * directory, so `scopeIdentity` must be a `sha256:` digest and `checkId` a
 * catalogue-shaped id.
 */
export interface AppDoctorResultKey {
  readonly scopeIdentity: string
  readonly checkId: string
  readonly mode: AppDoctorWriterMode
}

export type AppDoctorStoreErrorCode =
  | 'invalid-context'
  | 'invalid-input'
  | 'duplicate-key'
  | 'mode-mismatch'
  | 'unsafe-path'
  | 'inaccessible'
  | 'io'
  | 'oversized'
  | 'malformed'
  | 'invalid'
  | 'misowned'
  | 'filename-mismatch'
  | 'enumeration'
  | 'locked'
  | 'non-cooperative-change'
  | 'edit-conflict'

export interface AppDoctorStoreDiagnostic {
  readonly code: AppDoctorStoreErrorCode
  readonly path: string
  readonly message: string
  /** Position of the offending entry or edit in the caller's input, when one applies. */
  readonly index?: number
  readonly errno?: string
}

export interface AppDoctorResultRead {
  readonly store: 'present' | 'missing' | 'unavailable'
  readonly results: {readonly key: AppDoctorResultKey; readonly result: AppDoctorResult}[]
  /** Keys with no stored result. Errors are never reported here; they are diagnostics. */
  readonly missing: {readonly key: AppDoctorResultKey; readonly reason: 'store' | 'file'}[]
  readonly diagnostics: AppDoctorStoreDiagnostic[]
}

export interface AppDoctorPreviousData {
  readonly status: 'retained'
  readonly path: string
}

export type AppDoctorPublicationReceipt =
  | {
      readonly status: 'created' | 'replaced' | 'unchanged'
      readonly previous?: AppDoctorPreviousData
      readonly warnings: AppDoctorStoreDiagnostic[]
    }
  | {
      /**
       * The current file was not replaced. A `non-cooperative-change` failure
       * is reported after `previous` has already been rotated to the snapshot
       * read under the guard, so `previous` may be newer than the current file.
       */
      readonly status: 'failed'
      readonly diagnostics: AppDoctorStoreDiagnostic[]
    }

export type AppDoctorResultReceipt = {readonly index: number; readonly key: AppDoctorResultKey} & (
  | AppDoctorPublicationReceipt
  | {readonly status: 'unattempted'}
)

export type AppDoctorResultBatch =
  | {readonly status: 'rejected'; readonly diagnostics: AppDoctorStoreDiagnostic[]; readonly receipts: []}
  | {readonly status: 'complete' | 'partial'; readonly receipts: AppDoctorResultReceipt[]}

export interface AppDoctorSuppressionDocument {
  readonly schema_version: 1
  readonly configuration_identity: string
  readonly suppressions: Suppression[]
}

export type AppDoctorSuppressionRead =
  | {
      readonly status: 'ok'
      readonly document: AppDoctorSuppressionDocument
      readonly diagnostics: AppDoctorStoreDiagnostic[]
    }
  | {readonly status: 'missing'; readonly reason: 'store' | 'file'; readonly diagnostics: AppDoctorStoreDiagnostic[]}
  | {readonly status: 'error'; readonly diagnostics: AppDoctorStoreDiagnostic[]}

export type AppDoctorSuppressionEdit =
  | {readonly operation: 'add'; readonly value: Suppression}
  | {readonly operation: 'replace'; readonly id: string; readonly expected: Suppression; readonly value: Suppression}
  | {readonly operation: 'remove'; readonly id: string; readonly expected: Suppression}

export type AppDoctorSuppressionEditResult =
  | {readonly status: 'rejected'; readonly diagnostics: AppDoctorStoreDiagnostic[]}
  | AppDoctorPublicationReceipt

/** Tuning knobs for publication. Production callers use the defaults. */
export interface AppDoctorStoreOptions {
  /** Upper bound on how long a writer waits for a foreign guard before reporting `locked`. */
  readonly lockWaitMilliseconds?: number
}
