import type {AppDoctorSubmission} from './app-doctor-engine/index.js'

export interface AppDoctorSubmissionPayload {
  submission: AppDoctorSubmission
  bytes: Buffer
}

export function prepareSubmissionPayload(submission: AppDoctorSubmission): AppDoctorSubmissionPayload {
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
