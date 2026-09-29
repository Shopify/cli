import {
  formatResultsSummary,
  renderSecuritySubmitConfirmation,
  renderSecuritySubmitDryRun,
  renderSecuritySubmitFeedbackPrompt,
  renderSecuritySubmitSuccess,
  renderSecuritySubmitResult,
} from './security-submit-output.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {appSecurityResultsFor} from './app-security-results.test-data.js'
import {buildSubmission} from './app-security-engine/index.js'
import {renderInfo, renderSelectPrompt, renderSuccess, renderTextPrompt, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError, shouldReportErrorAsUnexpected} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {AppSecurityResults} from './app-security-results.js'
import type {CombinedCheck} from './app-security-engine/index.js'

vi.mock('@shopify/cli-kit/node/ui')

const buildOptions = {cliVersion: '3.99.0', submittedAt: '2026-09-01T09:30:00.000Z'}
const submissionPath = '/tmp/app/.shopify/app-security/submission.json'

function results({agent = true}: {agent?: boolean} = {}): AppSecurityResults {
  return appSecurityResultsFor('/tmp/app', {
    deterministic: deterministicFindingsDocument,
    agent: agent ? agentFindingsDocument : null,
  })
}

function submission(feedback?: string) {
  return buildSubmission(
    {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument},
    {
      ...buildOptions,
      feedback,
    },
  )
}

describe('renderSecuritySubmitResult', () => {
  test('renders dry-run and submitted results through the standard human output', () => {
    const payload = {path: submissionPath, schemaVersion: 2 as const}
    renderSecuritySubmitResult({status: 'dry-run', payload})
    renderSecuritySubmitResult({
      status: 'submitted',
      payload,
      submittedAt: 'now',
      appTitle: 'Example app',
      clientId: 'example-client-id',
      feedbackIncluded: false,
    })

    expect(renderInfo).toHaveBeenCalledOnce()
    expect(renderSuccess).toHaveBeenCalledOnce()
  })

  test('cancellation is silent', () => {
    renderSecuritySubmitResult({status: 'cancelled'})

    expect(renderInfo).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('converts failure data to an expected error retaining retry help', () => {
    const render = () =>
      renderSecuritySubmitResult({
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

describe('renderSecuritySubmitFeedbackPrompt', () => {
  test('warns about privacy, then asks the open question with empty input shown as skipped', async () => {
    const feedback = 'a'.repeat(2001)
    vi.mocked(renderTextPrompt).mockResolvedValue(feedback)

    await expect(renderSecuritySubmitFeedbackPrompt()).resolves.toBe(feedback)

    expect(renderWarning).toHaveBeenCalledExactlyOnceWith({
      headline: "Don't include source code, file paths or secrets in your feedback.",
    })
    expect(vi.mocked(renderWarning).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(renderTextPrompt).mock.invocationCallOrder[0]!,
    )
    expect(renderTextPrompt).toHaveBeenCalledExactlyOnceWith({
      message: 'What was accurate, inaccurate or unhelpful about these results?',
      allowEmpty: true,
      emptyDisplayedValue: '(skipped)',
    })
  })
})

describe('formatResultsSummary', () => {
  test('uses the review summary words for the combined checks', () => {
    // Combined: CREDENTIAL_LOG_LEAKAGE, EOL_API_VERSION and MISSING_TENANT_ISOLATION have active findings;
    // OPEN_REDIRECT passed; UNSAFE_INNERHTML is not applicable; UNAUTHENTICATED_ENDPOINT is unresolved.
    expect(formatResultsSummary(results().checks)).toBe(
      '3 checks with findings · 1 passed · 1 not applicable · 1 unresolved',
    )
  })

  test('singularizes one check with findings and leaves zero parts out', () => {
    const checks = results().checks
    const oneWithFindings = checks.filter((check) => check.id === 'EOL_API_VERSION' || check.id === 'OPEN_REDIRECT')

    expect(formatResultsSummary(oneWithFindings)).toBe('1 check with findings · 1 passed')
  })

  test('says "No checks" when there is nothing to count', () => {
    const none: CombinedCheck[] = []

    expect(formatResultsSummary(none)).toBe('No checks')
  })
})

describe('renderSecuritySubmitConfirmation', () => {
  test('encourages feedback first, by default, when none was supplied', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('submit-with-feedback')

    await expect(
      renderSecuritySubmitConfirmation({
        appTitle: 'Example app',
        submissionPath,
        submission: submission(),
        results: results(),
        canAddFeedback: true,
      }),
    ).resolves.toBe('submit-with-feedback')

    expect(renderSelectPrompt).toHaveBeenCalledExactlyOnceWith({
      message: 'Send App Security results for Example app to Shopify?',
      choices: [
        {label: 'Add feedback, then send', value: 'submit-with-feedback', key: 'f'},
        {label: 'Send without feedback', value: 'submit', key: 'y'},
        {label: 'Cancel', value: 'cancel', key: 'n'},
      ],
      defaultValue: 'submit-with-feedback',
      isConfirmationPrompt: true,
      infoTable: {
        Results: ['3 checks with findings · 1 passed · 1 not applicable · 1 unresolved'],
        Files: ['deterministic-findings.json, agent-findings.json'],
        Excluded: [
          'file paths, code snippets, evidence, finding messages, agent reasoning and reasons, suppression justifications, commit SHA',
        ],
        Payload: [{filePath: submissionPath}],
      },
    })
  })

  test('lists only the present file when the agent has not recorded results', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('cancel')

    await renderSecuritySubmitConfirmation({
      appTitle: 'Example app',
      submissionPath,
      submission: buildSubmission({deterministic: deterministicFindingsDocument, agent: null}, buildOptions),
      results: results({agent: false}),
      canAddFeedback: true,
    })

    expect(renderSelectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        infoTable: expect.objectContaining({
          Results: ['2 checks with findings · 1 passed · 1 not applicable · 1 unresolved'],
          Files: ['deterministic-findings.json'],
        }),
      }),
    )
  })

  test('discloses supplied feedback, defaults to sending and does not offer to collect it again', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('submit')

    await expect(
      renderSecuritySubmitConfirmation({
        appTitle: 'Example app',
        submissionPath,
        submission: submission('Something was inaccurate.'),
        results: results(),
        canAddFeedback: false,
      }),
    ).resolves.toBe('submit')

    expect(renderSelectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          {label: 'Yes, send', value: 'submit', key: 'y'},
          {label: 'Cancel', value: 'cancel', key: 'n'},
        ],
        defaultValue: 'submit',
        infoTable: expect.objectContaining({Included: ['Optional feedback, sent without redaction']}),
      }),
    )
  })

  test('omits the Included row when the payload carries no feedback', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('submit')

    await renderSecuritySubmitConfirmation({
      appTitle: 'Example app',
      submissionPath,
      submission: submission(),
      results: results(),
      canAddFeedback: false,
    })

    expect(vi.mocked(renderSelectPrompt).mock.calls[0]![0].infoTable).not.toHaveProperty('Included')
  })
})

describe('renderSecuritySubmitDryRun', () => {
  test('states that nothing was sent and points to the payload', () => {
    renderSecuritySubmitDryRun({submissionPath})

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Prepared the App Security submission without sending it.',
      body: ['Payload: ', {filePath: submissionPath}],
    })
  })
})

describe('renderSecuritySubmitSuccess', () => {
  test('includes the app and payload path', () => {
    renderSecuritySubmitSuccess({appTitle: 'Example app', submissionPath, feedbackIncluded: false})

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Sent App Security results for Example app.',
      body: ['Payload: ', {filePath: submissionPath}],
    })
  })

  test('thanks the user when feedback was included', () => {
    renderSecuritySubmitSuccess({appTitle: 'Example app', submissionPath, feedbackIncluded: true})

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Sent App Security results for Example app.',
      body: ['Thanks for your feedback.\n\nPayload: ', {filePath: submissionPath}],
    })
  })
})
