import {
  renderDoctorSubmitConfirmation,
  renderDoctorSubmitDryRun,
  renderDoctorSubmitSuccess,
} from './doctor-submit-output.js'
import {submissionTraceFixture} from './app-doctor-engine/tests/fixtures/submission-trace.js'
import {buildSubmission} from './app-doctor-engine/submission/index.js'
import {renderConfirmationPrompt, renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

const submission = buildSubmission(submissionTraceFixture, {
  cliVersion: '3.99.0',
  submittedAt: '2026-09-01T09:30:00.000Z',
})
const submissionPath = '/tmp/app/.shopify/app-doctor/submission.json'

describe('renderDoctorSubmitConfirmation', () => {
  test('summarizes findings/checks, exclusions, payload, and dirty state', async () => {
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    await expect(renderDoctorSubmitConfirmation({appTitle: 'Example app', submissionPath, submission})).resolves.toBe(
      true,
    )

    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Submit App Doctor results for Example app to Shopify?',
      confirmationMessage: 'Yes, submit',
      cancellationMessage: 'No, cancel',
      infoTable: {
        Findings: ['1 high · 1 medium · 1 low (1 suppressed)'],
        Checks: ['3 executed · 1 not applicable · 1 unresolved'],
        Excluded: ['file paths, code snippets, evidence, messages, commit SHA'],
        Payload: [{filePath: submissionPath}],
        Warning: [{warn: 'The trace was generated with uncommitted changes.'}],
      },
    })
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
