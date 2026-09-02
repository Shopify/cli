import {
  renderDoctorSubmitConfirmation,
  renderDoctorSubmitDryRun,
  renderDoctorSubmitFeedbackPrompt,
  renderDoctorSubmitSuccess,
  renderDoctorSubmitResult,
} from './doctor-submit-output.js'
import {submissionTraceFixture} from './app-doctor-engine/tests/fixtures/submission-trace.js'
import {buildSubmission} from './app-doctor-engine/index.js'
import {renderInfo, renderSelectPrompt, renderSuccess, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError, shouldReportErrorAsUnexpected} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

const submission = buildSubmission(submissionTraceFixture, {
  cliVersion: '3.99.0',
  submittedAt: '2026-09-01T09:30:00.000Z',
})
const submissionPath = '/tmp/app/.shopify/app-doctor/submission.json'

describe('renderDoctorSubmitResult', () => {
  test('renders dry-run and submitted results through the standard human output', () => {
    const payload = {path: submissionPath, schemaVersion: 1 as const}
    renderDoctorSubmitResult({status: 'dry-run', payload})
    renderDoctorSubmitResult({status: 'submitted', payload, submittedAt: 'now', appTitle: 'Example app'})

    expect(renderInfo).toHaveBeenCalledOnce()
    expect(renderSuccess).toHaveBeenCalledOnce()
  })

  test('cancellation is silent', () => {
    renderDoctorSubmitResult({status: 'cancelled'})

    expect(renderInfo).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('converts failure data to an expected error retaining retry help', () => {
    const render = () =>
      renderDoctorSubmitResult({
        status: 'failed',
        error: {stage: 'upload', message: 'Upload failed', tryMessage: 'Try again.', nextSteps: ['Check connection.']},
      })

    expect(render).toThrow(new AbortError('Upload failed', 'Try again.', ['Check connection.']))
    try {
      render()
    } catch (error) {
      if (!(error instanceof AbortError)) throw error
      expect(shouldReportErrorAsUnexpected(error)).toBe(false)
      expect(error).toMatchObject({tryMessage: 'Try again.', nextSteps: ['Check connection.']})
    }
  })
})

describe('renderDoctorSubmitFeedbackPrompt', () => {
  test('shows only the privacy warning and prompts without a size validator', async () => {
    const feedback = 'a'.repeat(2001)
    vi.mocked(renderTextPrompt).mockResolvedValue(feedback)

    await expect(renderDoctorSubmitFeedbackPrompt()).resolves.toBe(feedback)

    expect(renderWarning).toHaveBeenCalledExactlyOnceWith({
      headline: "Don't include source code, file paths or secrets in your optional feedback.",
    })
    expect(vi.mocked(renderWarning).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(renderTextPrompt).mock.invocationCallOrder[0]!,
    )
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'Optional: What was inaccurate or unhelpful about these App Doctor results?',
      allowEmpty: true,
      emptyDisplayedValue: '(skipped)',
    })
  })
})

describe('renderDoctorSubmitConfirmation', () => {
  test('offers an action to add optional feedback when none was supplied', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('submit-with-feedback')

    await expect(
      renderDoctorSubmitConfirmation({appTitle: 'Example app', submissionPath, submission, canAddFeedback: true}),
    ).resolves.toBe('submit-with-feedback')

    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Submit App Doctor results for Example app to Shopify?',
      choices: [
        {label: 'Yes, submit', value: 'submit', key: 'y'},
        {label: 'Add optional feedback, then submit', value: 'submit-with-feedback', key: 'f'},
        {label: 'No, cancel', value: 'cancel', key: 'n'},
      ],
      defaultValue: 'submit',
      isConfirmationPrompt: true,
      infoTable: {
        Findings: ['1 high · 1 medium · 1 low (1 suppressed)'],
        Checks: ['3 executed · 1 not applicable · 1 unresolved'],
        Excluded: ['file paths, code snippets, evidence, finding messages, commit SHA'],
        Payload: [{filePath: submissionPath}],
        Warning: [{warn: 'The trace was generated with uncommitted changes.'}],
      },
    })
  })

  test('discloses supplied feedback and does not offer to collect it again', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('submit')
    const submissionWithFeedback = buildSubmission(submissionTraceFixture, {
      cliVersion: '3.99.0',
      submittedAt: '2026-09-01T09:30:00.000Z',
      feedback: 'Something was inaccurate.',
    })

    await renderDoctorSubmitConfirmation({
      appTitle: 'Example app',
      submissionPath,
      submission: submissionWithFeedback,
      canAddFeedback: false,
    })

    expect(renderSelectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          {label: 'Yes, submit', value: 'submit', key: 'y'},
          {label: 'No, cancel', value: 'cancel', key: 'n'},
        ],
        infoTable: expect.objectContaining({Included: ['Optional feedback, sent without redaction']}),
      }),
    )
  })
})

describe('renderDoctorSubmitDryRun', () => {
  test('states that nothing was uploaded and points to the payload', () => {
    renderDoctorSubmitDryRun({submissionPath})

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Prepared the App Doctor submission without uploading it.',
      body: ['Payload: ', {filePath: submissionPath}],
    })
  })
})

describe('renderDoctorSubmitSuccess', () => {
  test('includes the app and payload path', () => {
    renderDoctorSubmitSuccess({appTitle: 'Example app', submissionPath})

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Submitted App Doctor results for Example app.',
      body: ['Payload: ', {filePath: submissionPath}],
    })
  })
})
