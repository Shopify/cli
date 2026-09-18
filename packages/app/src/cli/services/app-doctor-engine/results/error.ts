import type {zod} from '@shopify/cli-kit/node/schema'

/**
 * Raised by the result contract when input cannot become a valid result.
 *
 * This is deliberately a plain `Error`, not a cli-kit `AbortError`: the result
 * contract is a pure library boundary and callers decide how to surface it.
 * Messages are fixed text and never echo input values, because input may carry
 * secrets that must not leak through error reporting.
 */
export class AppDoctorResultError extends Error {
  readonly details: ReadonlyArray<string>
  /** Zero-based position of the finding that caused the rejection, when one finding is to blame. */
  readonly findingIndex?: number

  constructor(summary: string, details: ReadonlyArray<string> = [], options: {findingIndex?: number} = {}) {
    super(details.length === 0 ? summary : `${summary}: ${details.join('; ')}`)
    this.name = 'AppDoctorResultError'
    this.details = details
    if (options.findingIndex !== undefined) this.findingIndex = options.findingIndex
  }
}

const ISSUE_DESCRIPTIONS: Partial<Record<zod.ZodIssueCode, string>> = {
  invalid_type: 'invalid type',
  invalid_literal: 'unexpected literal',
  unrecognized_keys: 'unrecognized keys',
  invalid_union: 'no matching variant',
  invalid_union_discriminator: 'unexpected discriminator',
  invalid_enum_value: 'unexpected value',
  invalid_string: 'invalid string',
  too_small: 'out of range',
  too_big: 'out of range',
  not_finite: 'not finite',
}

/**
 * Convert Zod issues into fixed, non-echoing descriptions. Zod's own messages
 * quote received values and unknown keys, which may be secret-bearing.
 * Custom issues are raised by this contract with fixed text, so they are kept.
 */
export function describeSchemaIssues(issues: ReadonlyArray<zod.ZodIssue>): string[] {
  return issues.map((issue) => {
    const location = issue.path.length === 0 ? 'result' : issue.path.join('.')
    const description = issue.code === 'custom' ? issue.message : (ISSUE_DESCRIPTIONS[issue.code] ?? 'invalid value')
    return `${location}: ${description}`
  })
}
