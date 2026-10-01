import {checkStatusLabels, checksWithFindingsLabel} from './app-security-format.js'
import {summarizeCombinedChecks} from './app-security-engine/index.js'
import {renderInfo, renderSelectPrompt, renderSuccess, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename} from '@shopify/cli-kit/node/path'
import type {SecuritySubmitResult} from './security-submit-result.js'
import type {AppSecuritySubmission, CombinedCheck} from './app-security-engine/index.js'
import type {AppSecurityResults} from './app-security-results.js'

export type SecuritySubmitConfirmationAction = 'submit' | 'submit-with-feedback' | 'cancel'

export interface SecuritySubmitConfirmationInput {
  appTitle: string
  submissionPath: string
  submission: AppSecuritySubmission
  /** The loaded results the payload was built from; the confirmation summarizes them like `review` does. */
  results: AppSecurityResults
  canAddFeedback: boolean
}

interface SecuritySubmitDryRunInput {
  submissionPath: string
}

interface SecuritySubmitSuccessInput {
  appTitle: string
  submissionPath: string
  feedbackIncluded: boolean
}

const EXCLUDED_FROM_UPLOAD =
  'file paths, code snippets, evidence, finding messages, agent reasoning and reasons, suppression justifications, commit SHA'

export function renderSecuritySubmitResult(result: SecuritySubmitResult): void {
  switch (result.status) {
    case 'dry-run':
      renderSecuritySubmitDryRun({submissionPath: result.payload.path})
      break
    case 'submitted':
      renderSecuritySubmitSuccess({
        appTitle: result.appTitle,
        submissionPath: result.payload.path,
        feedbackIncluded: result.feedbackIncluded,
      })
      break
    case 'failed':
      // Leave expected human errors to the standard command error handler and banner.
      throw new AbortError(result.error.message, result.error.tryMessage, result.error.nextSteps)
    case 'cancelled':
      break
  }
}

/** The same words as `review`'s summary, so the confirmation describes what the user has already seen. */
export function formatResultsSummary(checks: CombinedCheck[]): string {
  const summary = summarizeCombinedChecks(checks)
  const parts = [...(summary.withFindings > 0 ? [checksWithFindingsLabel(summary)] : []), ...checkStatusLabels(summary)]
  return parts.length === 0 ? 'No checks' : parts.join(' · ')
}

function presentFileNames(results: AppSecurityResults): string[] {
  return [results.sources.deterministic, results.sources.agent]
    .filter((source) => source !== null)
    .map((source) => basename(source.path))
}

export async function renderSecuritySubmitFeedbackPrompt(): Promise<string> {
  renderWarning({headline: "Don't include source code, file paths or secrets in your feedback."})
  return renderTextPrompt({
    message: 'What was accurate, inaccurate or unhelpful about these results?',
    allowEmpty: true,
    emptyDisplayedValue: '(skipped)',
  })
}

export function renderSecuritySubmitConfirmation(
  input: SecuritySubmitConfirmationInput,
): Promise<SecuritySubmitConfirmationAction> {
  const choices: {label: string; value: SecuritySubmitConfirmationAction; key: string}[] = input.canAddFeedback
    ? [
        // Feedback comes first and is the default to encourage it.
        {label: 'Add feedback, then send', value: 'submit-with-feedback', key: 'f'},
        {label: 'Send without feedback', value: 'submit', key: 'y'},
        {label: 'Cancel', value: 'cancel', key: 'n'},
      ]
    : [
        {label: 'Yes, send', value: 'submit', key: 'y'},
        {label: 'Cancel', value: 'cancel', key: 'n'},
      ]

  return renderSelectPrompt({
    message: `Send App Security results for ${input.appTitle} to Shopify?`,
    choices,
    defaultValue: input.canAddFeedback ? 'submit-with-feedback' : 'submit',
    isConfirmationPrompt: true,
    infoTable: {
      Results: [formatResultsSummary(input.results.checks)],
      Files: [presentFileNames(input.results).join(', ')],
      ...(input.submission.report.feedback === null ? {} : {Included: ['Optional feedback, sent without redaction']}),
      Excluded: [EXCLUDED_FROM_UPLOAD],
      Payload: [{filePath: input.submissionPath}],
    },
  })
}

export function renderSecuritySubmitDryRun({submissionPath}: SecuritySubmitDryRunInput): void {
  renderInfo({
    headline: 'Prepared the App Security submission without sending it.',
    body: ['Payload: ', {filePath: submissionPath}],
  })
}

export function renderSecuritySubmitSuccess({
  appTitle,
  submissionPath,
  feedbackIncluded,
}: SecuritySubmitSuccessInput): void {
  renderSuccess({
    headline: `Sent App Security results for ${appTitle}.`,
    body: feedbackIncluded
      ? ['Thanks for your feedback.\n\nPayload: ', {filePath: submissionPath}]
      : ['Payload: ', {filePath: submissionPath}],
  })
}
