import {renderConfirmationPrompt, renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import type {AppDoctorSubmission} from './app-doctor-engine/submission/index.js'

export interface DoctorSubmitConfirmationInput {
  appTitle: string
  submissionPath: string
  submission: AppDoctorSubmission
}

export interface DoctorSubmitDryRunInput {
  submissionPath: string
}

export interface DoctorSubmitSuccessInput {
  appTitle: string
  scanId?: string
  submissionPath: string
}

function findingsSummary(submission: AppDoctorSubmission): string {
  const count = (severity: 'high' | 'medium' | 'low') =>
    submission.findings.filter((finding) => finding.severity === severity).length
  const suppressed = submission.findings.filter((finding) => finding.suppressed).length
  return `${count('high')} high · ${count('medium')} medium · ${count('low')} low${
    suppressed === 0 ? '' : ` (${suppressed} suppressed)`
  }`
}

function checksSummary(submission: AppDoctorSubmission): string {
  const executed = submission.checks_executed.filter((check) => check.status === 'executed').length
  const notApplicable = submission.checks_executed.filter((check) => check.status === 'not_applicable').length
  const unresolved = submission.checks_executed.filter(
    (check) => check.status === 'unresolved' || check.status === 'unsupported_framework',
  ).length
  return `${executed} executed · ${notApplicable} not applicable · ${unresolved} unresolved`
}

export function renderDoctorSubmitConfirmation(input: DoctorSubmitConfirmationInput): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Submit App Doctor results for ${input.appTitle} to Shopify?`,
    confirmationMessage: 'Yes, submit',
    cancellationMessage: 'No, cancel',
    infoTable: {
      Findings: [findingsSummary(input.submission)],
      Checks: [checksSummary(input.submission)],
      Excluded: ['file paths, code snippets, evidence, messages, commit SHA'],
      Payload: [{filePath: input.submissionPath}],
      ...(input.submission.project.dirty === true
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

export function renderDoctorSubmitSuccess({appTitle, scanId, submissionPath}: DoctorSubmitSuccessInput): void {
  renderSuccess({
    headline: `Submitted App Doctor results for ${appTitle}.`,
    body: scanId
      ? [`Scan ID: ${scanId}\nPayload: `, {filePath: submissionPath}]
      : ['Payload: ', {filePath: submissionPath}],
  })
}
