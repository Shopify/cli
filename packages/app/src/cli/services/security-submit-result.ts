import {AbortError} from '@shopify/cli-kit/node/error'
import {FetchError} from '@shopify/cli-kit/node/http'
import type {SUBMISSION_SCHEMA_VERSION} from './app-security-engine/index.js'
import type {SourceScanCreateSchema} from '../utilities/developer-platform-client.js'

export interface SecuritySubmitPayload {
  path: string
  schemaVersion: typeof SUBMISSION_SCHEMA_VERSION
}

export interface SecuritySubmitError {
  stage: 'preparation' | 'upload-url' | 'upload' | 'create'
  message: string
  userErrors?: SourceScanCreateSchema['userErrors']
  accepted?: boolean
  tryMessage?: AbortError['tryMessage']
  nextSteps?: AbortError['nextSteps']
}

export interface SecuritySubmitFailure {
  status: 'failed'
  error: SecuritySubmitError
}

export type SubmitAppSecurityScanResult = {status: 'submitted'} | SecuritySubmitFailure

export type SecuritySubmitResult =
  | {status: 'dry-run'; payload: SecuritySubmitPayload}
  | {status: 'submitted'; payload: SecuritySubmitPayload; submittedAt: string; appTitle: string; clientId: string}
  | {status: 'cancelled'}
  | SecuritySubmitFailure

export function securitySubmitFailure(
  error: unknown,
  stage: SecuritySubmitError['stage'],
): SecuritySubmitFailure | undefined {
  if (error instanceof FetchError) {
    // FetchError messages can contain signed upload URLs. Expose only safe recovery guidance.
    return {
      status: 'failed',
      error: {
        stage,
        message: 'A network error interrupted the App Security submission.',
        tryMessage: 'Check your network connection and try submitting the App Security results again.',
      },
    }
  }
  // Leave unrecognized errors to the caller so programming defects still propagate.
  if (!(error instanceof AbortError)) return undefined

  return {
    status: 'failed',
    error: {stage, message: error.message, tryMessage: error.tryMessage, nextSteps: error.nextSteps},
  }
}
