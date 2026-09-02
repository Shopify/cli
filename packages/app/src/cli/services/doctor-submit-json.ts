import {itemToString, unstyled} from '@shopify/cli-kit/node/output'
import type {DoctorSubmitError, DoctorSubmitPayload, DoctorSubmitResult} from './doctor-submit-result.js'

interface DoctorSubmitJsonPayload {
  path: string
  schema_version: DoctorSubmitPayload['schemaVersion']
}

type DoctorSubmitJsonResult =
  | {operation: 'submit'; dry_run: true; payload: DoctorSubmitJsonPayload}
  | {operation: 'submit'; dry_run: false; payload: DoctorSubmitJsonPayload; submitted_at: string}
  | {
      operation: 'submit'
      error: {
        message: string
        stage: DoctorSubmitError['stage']
        user_errors?: DoctorSubmitError['userErrors']
        accepted?: boolean
        try_message?: string
        next_steps?: string[]
      }
    }

export function toDoctorSubmitJson(result: Exclude<DoctorSubmitResult, {status: 'cancelled'}>): DoctorSubmitJsonResult {
  if (result.status === 'failed') {
    return {
      operation: 'submit',
      error: {
        message: result.error.message,
        stage: result.error.stage,
        ...(result.error.userErrors === undefined ? {} : {user_errors: result.error.userErrors}),
        ...(result.error.accepted === undefined ? {} : {accepted: result.error.accepted}),
        ...(result.error.tryMessage === undefined || result.error.tryMessage === null
          ? {}
          : {try_message: unstyled(itemToString(result.error.tryMessage))}),
        ...(result.error.nextSteps === undefined
          ? {}
          : {next_steps: result.error.nextSteps.map((step) => unstyled(itemToString(step)))}),
      },
    }
  }

  const payload = {path: result.payload.path, schema_version: result.payload.schemaVersion}
  if (result.status === 'dry-run') return {operation: 'submit', dry_run: true, payload}
  return {operation: 'submit', dry_run: false, payload, submitted_at: result.submittedAt}
}

export function encodeDoctorSubmitJson(result: DoctorSubmitJsonResult): string {
  return JSON.stringify(result, null, 2)
}
