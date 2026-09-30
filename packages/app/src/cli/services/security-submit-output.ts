import {renderInfo, renderSelectPrompt, renderSuccess, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {SecuritySubmitResult} from './security-submit-result.js'
import type {AppSecuritySubmission} from './app-security-engine/index.js'

export type SecuritySubmitConfirmationAction = 'submit' | 'submit-with-feedback' | 'cancel'

export interface SecuritySubmitConfirmationInput {
  appTitle: string
  submissionPath: string
  submission: AppSecuritySubmission
  canAddFeedback: boolean
}

interface SecuritySubmitDryRunInput {
  submissionPath: string
}

interface SecuritySubmitSuccessInput {
  appTitle: string
  submissionPath: string
}

export function renderSecuritySubmitResult(result: SecuritySubmitResult): void {
  switch (result.status) {
    case 'dry-run':
      renderSecuritySubmitDryRun({submissionPath: result.payload.path})
      break
    case 'submitted':
      renderSecuritySubmitSuccess({appTitle: result.appTitle, submissionPath: result.payload.path})
      break
    case 'failed':
      // Leave expected human errors to the standard command error handler and banner.
      throw new AbortError(result.error.message, result.error.tryMessage, result.error.nextSteps)
    case 'cancelled':
      break
  }
}

function findingsSummary(submission: AppSecuritySubmission): string {
  const count = (severity: 'high' | 'medium' | 'low') =>
    submission.report.findings.filter((finding) => finding.severity === severity).length
  const suppressed = submission.report.findings.filter((finding) => finding.suppressed).length
  return `${count('high')} high · ${count('medium')} medium · ${count('low')} low${
    suppressed === 0 ? '' : ` (${suppressed} suppressed)`
  }`
}

function checksSummary(submission: AppSecuritySubmission): string {
  const executed = submission.report.checks_executed.filter((check) => check.status === 'executed').length
  const notApplicable = submission.report.checks_executed.filter((check) => check.status === 'not_applicable').length
  const unresolved = submission.report.checks_executed.filter(
    (check) => check.status === 'unresolved' || check.status === 'unsupported_framework',
  ).length
  return `${executed} executed · ${notApplicable} not applicable · ${unresolved} unresolved`
}

export async function renderSecuritySubmitFeedbackPrompt(): Promise<string> {
  renderWarning({headline: "Don't include source code, file paths or secrets in your optional feedback."})
  return renderTextPrompt({
    message: 'Optional: What was inaccurate or unhelpful about these App Security results?',
    allowEmpty: true,
    emptyDisplayedValue: '(skipped)',
  })
}

export function renderSecuritySubmitConfirmation(
  input: SecuritySubmitConfirmationInput,
): Promise<SecuritySubmitConfirmationAction> {
  const choices: {label: string; value: SecuritySubmitConfirmationAction; key: string}[] = [
    {label: 'Yes, submit', value: 'submit', key: 'y'},
    ...(input.canAddFeedback
      ? [{label: 'Add optional feedback, then submit', value: 'submit-with-feedback' as const, key: 'f'}]
      : []),
    {label: 'No, cancel', value: 'cancel', key: 'n'},
  ]

  return renderSelectPrompt({
    message: `Submit App Security results for ${input.appTitle} to Shopify?`,
    choices,
    defaultValue: 'submit',
    isConfirmationPrompt: true,
    infoTable: {
      Findings: [findingsSummary(input.submission)],
      Checks: [checksSummary(input.submission)],
      ...(input.submission.report.feedback === null ? {} : {Included: ['Optional feedback, sent without redaction']}),
      Excluded: ['file paths, code snippets, evidence, finding messages, commit SHA'],
      Payload: [{filePath: input.submissionPath}],
      ...(input.submission.report.project.dirty === true
        ? {Warning: [{warn: 'The trace was generated with uncommitted changes.'}]}
        : {}),
    },
  })
}

export function renderSecuritySubmitDryRun({submissionPath}: SecuritySubmitDryRunInput): void {
  renderInfo({
    headline: 'Prepared the App Security submission without uploading it.',
    body: ['Payload: ', {filePath: submissionPath}],
  })
}

export function renderSecuritySubmitSuccess({appTitle, submissionPath}: SecuritySubmitSuccessInput): void {
  renderSuccess({
    headline: `Submitted App Security results for ${appTitle}.`,
    body: ['Payload: ', {filePath: submissionPath}],
  })
}
