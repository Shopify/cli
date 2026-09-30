import type {AppSecuritySubmission} from './app-security-engine/index.js'

export interface AppSecuritySubmissionPayload {
  submission: AppSecuritySubmission
  bytes: Buffer
}

export function prepareSubmissionPayload(submission: AppSecuritySubmission): AppSecuritySubmissionPayload {
  const feedback = submission.report.feedback?.trim() ?? ''
  const normalizedSubmission = {
    ...submission,
    report: {...submission.report, feedback: feedback === '' ? null : feedback},
  }
  return {
    submission: normalizedSubmission,
    bytes: Buffer.from(`${JSON.stringify(normalizedSubmission, null, 2)}\n`, 'utf8'),
  }
}
