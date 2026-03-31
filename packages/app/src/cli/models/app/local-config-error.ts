import {AbortError} from '@shopify/cli-kit/node/error'
import type {OutputMessage} from '@shopify/cli-kit/node/output'
import type {AppValidationIssue} from './error-parsing.js'

/**
 * Structured local configuration failure shared by lower layers.
 *
 * This stays below command/JSON serialization concerns: callers can surface the
 * same file/path-aware issues through CLI output, machine-readable validation
 * results, or other higher-level flows.
 */
export class LocalConfigError extends AbortError {
  constructor(
    message: OutputMessage,
    public readonly configurationPath: string,
    public readonly issues: AppValidationIssue[] = [],
  ) {
    super(message)
  }
}
