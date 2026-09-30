import {itemToString, unstyled} from '@shopify/cli-kit/node/output'
import type {SecuritySubmitError, SecuritySubmitPayload, SecuritySubmitResult} from './security-submit-result.js'

interface SecuritySubmitJsonPayload {
  path: string
  schema_version: SecuritySubmitPayload['schemaVersion']
}

type SecuritySubmitJsonResult =
  | {operation: 'submit'; dry_run: true; payload: SecuritySubmitJsonPayload}
  | {operation: 'submit'; dry_run: false; payload: SecuritySubmitJsonPayload; submitted_at: string; client_id: string}
  | {
      operation: 'submit'
      error: {
        message: string
        stage: SecuritySubmitError['stage']
        user_errors?: SecuritySubmitError['userErrors']
        accepted?: boolean
        try_message?: string
        next_steps?: string[]
      }
    }

export function toSecuritySubmitJson(
  result: Exclude<SecuritySubmitResult, {status: 'cancelled'}>,
): SecuritySubmitJsonResult {
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
  return {operation: 'submit', dry_run: false, payload, submitted_at: result.submittedAt, client_id: result.clientId}
}

export function encodeSecuritySubmitJson(result: SecuritySubmitJsonResult): string {
  return JSON.stringify(result, null, 2)
}
