import {renderInfo, renderSelectPrompt, renderSuccess, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {DoctorSubmitResult} from './doctor-submit-result.js'
import type {AppDoctorSubmission} from './app-doctor-engine/index.js'

export type DoctorSubmitConfirmationAction = 'submit' | 'submit-with-feedback' | 'cancel'

export interface DoctorSubmitConfirmationInput {
  appTitle: string
  submissionPath: string
  submission: AppDoctorSubmission
  canAddFeedback: boolean
}

interface DoctorSubmitDryRunInput {
  submissionPath: string
}

interface DoctorSubmitSuccessInput {
  appTitle: string
  submissionPath: string
}

export function renderDoctorSubmitResult(result: DoctorSubmitResult): void {
  switch (result.status) {
    case 'dry-run':
      renderDoctorSubmitDryRun({submissionPath: result.payload.path})
      break
    case 'submitted':
      renderDoctorSubmitSuccess({appTitle: result.appTitle, submissionPath: result.payload.path})
      break
    case 'failed':
      // Leave expected human errors to the standard command error handler and banner.
      throw new AbortError(result.error.message, result.error.tryMessage, result.error.nextSteps)
    case 'cancelled':
      break
  }
}

function findingsSummary(submission: AppDoctorSubmission): string {
  const count = (severity: 'high' | 'medium' | 'low') =>
    submission.report.findings.filter((finding) => finding.severity === severity).length
  const suppressed = submission.report.findings.filter((finding) => finding.suppressed).length
  return `${count('high')} high · ${count('medium')} medium · ${count('low')} low${
    suppressed === 0 ? '' : ` (${suppressed} suppressed)`
  }`
}

function checksSummary(submission: AppDoctorSubmission): string {
  const executed = submission.report.checks_executed.filter((check) => check.status === 'executed').length
  const notApplicable = submission.report.checks_executed.filter((check) => check.status === 'not_applicable').length
  const unresolved = submission.report.checks_executed.filter(
    (check) => check.status === 'unresolved' || check.status === 'unsupported_framework',
  ).length
  return `${executed} executed · ${notApplicable} not applicable · ${unresolved} unresolved`
}

export async function renderDoctorSubmitFeedbackPrompt(): Promise<string> {
  renderWarning({headline: "Don't include source code, file paths or secrets in your optional feedback."})
  return renderTextPrompt({
    message: 'Optional: What was inaccurate or unhelpful about these App Doctor results?',
    allowEmpty: true,
    emptyDisplayedValue: '(skipped)',
  })
}

export function renderDoctorSubmitConfirmation(
  input: DoctorSubmitConfirmationInput,
): Promise<DoctorSubmitConfirmationAction> {
  const choices: {label: string; value: DoctorSubmitConfirmationAction; key: string}[] = [
    {label: 'Yes, submit', value: 'submit', key: 'y'},
    ...(input.canAddFeedback
      ? [{label: 'Add optional feedback, then submit', value: 'submit-with-feedback' as const, key: 'f'}]
      : []),
    {label: 'No, cancel', value: 'cancel', key: 'n'},
  ]

  return renderSelectPrompt({
    message: `Submit App Doctor results for ${input.appTitle} to Shopify?`,
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

export function renderDoctorSubmitDryRun({submissionPath}: DoctorSubmitDryRunInput): void {
  renderInfo({
    headline: 'Prepared the App Doctor submission without uploading it.',
    body: ['Payload: ', {filePath: submissionPath}],
  })
}

export function renderDoctorSubmitSuccess({appTitle, submissionPath}: DoctorSubmitSuccessInput): void {
  renderSuccess({
    headline: `Submitted App Doctor results for ${appTitle}.`,
    body: ['Payload: ', {filePath: submissionPath}],
  })
}
