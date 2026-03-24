import type {AppValidationIssue} from '../models/app/error-parsing.js'

interface AppValidationResult {
  valid: boolean
  issues: AppValidationIssue[]
}

/**
 * Public machine-readable result contract for `shopify app validate --json`.
 *
 * This is limited to local app configuration discovery, parsing, and
 * validation failures. Unrelated operational failures should continue through
 * the normal CLI error path instead of being serialized as validation JSON.
 */
export function validAppValidationResult(): AppValidationResult {
  return {valid: true, issues: []}
}

export function invalidAppValidationResult(issues: AppValidationIssue[]): AppValidationResult {
  return {valid: false, issues}
}

export function stringifyAppValidationResult(result: AppValidationResult): string {
  return JSON.stringify(result, null, 2)
}
