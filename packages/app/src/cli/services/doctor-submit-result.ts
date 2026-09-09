import {AbortError} from '@shopify/cli-kit/node/error'
import {FetchError} from '@shopify/cli-kit/node/http'
import type {SUBMISSION_SCHEMA_VERSION} from './app-doctor-engine/index.js'
import type {SourceScanCreateSchema} from '../utilities/developer-platform-client.js'

export interface DoctorSubmitPayload {
  path: string
  schemaVersion: typeof SUBMISSION_SCHEMA_VERSION
}

export interface DoctorSubmitError {
  stage: 'preparation' | 'upload-url' | 'upload' | 'create'
  message: string
  userErrors?: SourceScanCreateSchema['userErrors']
  accepted?: boolean
  tryMessage?: AbortError['tryMessage']
  nextSteps?: AbortError['nextSteps']
}

export interface DoctorSubmitFailure {
  status: 'failed'
  error: DoctorSubmitError
}

export type SubmitAppDoctorScanResult = {status: 'submitted'} | DoctorSubmitFailure

export type DoctorSubmitResult =
  | {status: 'dry-run'; payload: DoctorSubmitPayload}
  | {status: 'submitted'; payload: DoctorSubmitPayload; submittedAt: string; appTitle: string; clientId: string}
  | {status: 'cancelled'}
  | DoctorSubmitFailure

export function doctorSubmitFailure(
  error: unknown,
  stage: DoctorSubmitError['stage'],
): DoctorSubmitFailure | undefined {
  if (error instanceof FetchError) {
    // FetchError messages can contain signed upload URLs. Expose only safe recovery guidance.
    return {
      status: 'failed',
      error: {
        stage,
        message: 'A network error interrupted the App Doctor submission.',
        tryMessage: 'Check your network connection and try submitting the App Doctor results again.',
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
