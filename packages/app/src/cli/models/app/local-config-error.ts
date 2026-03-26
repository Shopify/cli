import {toRootValidationIssue, type AppValidationIssue} from './error-parsing.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {stringifyMessage, type OutputMessage} from '@shopify/cli-kit/node/output'

/**
 * Structured local configuration failure shared by lower layers.
 *
 * This stays below command/JSON serialization concerns: callers can surface the
 * same file/path-aware issues through CLI output, machine-readable validation
 * results, or other higher-level flows.
 */
export class LocalConfigError extends AbortError {
  public readonly issues: AppValidationIssue[]

  constructor(
    message: OutputMessage,
    public readonly configurationPath: string,
    issues: AppValidationIssue[] = [],
  ) {
    super(message)
    this.issues =
      issues.length > 0 ? issues : [toRootValidationIssue(configurationPath, stringifyMessage(message).trim())]
  }
}
