import {prepareSubmissionPayload} from './app-doctor-submission-payload.js'
import {buildSubmission} from './app-doctor-engine/index.js'
import {submissionTraceFixture} from './app-doctor-engine/tests/fixtures/submission-trace.js'
import {describe, expect, test} from 'vitest'

function submissionFixture() {
  return buildSubmission(submissionTraceFixture, {cliVersion: 'test', submittedAt: '2026-09-08'})
}

describe('prepareSubmissionPayload', () => {
  test('encodes reports larger than the former 1 MiB limit', () => {
    const submission = submissionFixture()
    submission.report.metadata.version_tag = 'a'.repeat(1024 * 1024)

    const payload = prepareSubmissionPayload(submission)

    expect(payload.bytes.length).toBeGreaterThan(1024 * 1024)
    expect(payload.bytes.toString()).toBe(`${JSON.stringify(payload.submission, null, 2)}\n`)
    expect(payload.submission).toEqual(submission)
  })

  test('preserves feedback longer than the former 2,000-character cap without truncation', () => {
    const submission = submissionFixture()
    const feedback = 'a'.repeat(2001)
    submission.report.feedback = `  ${feedback}  `

    const payload = prepareSubmissionPayload(submission)

    expect(payload.submission.report.feedback).toBe(feedback)
    expect(payload.bytes.toString()).toContain(feedback)
    expect(submission.report.feedback).toBe(`  ${feedback}  `)
  })

  test('encodes Unicode and JSON escaping in the same bytes as the normalized submission', () => {
    const submission = submissionFixture()
    const feedback = 'é😀 "quoted" \\ slash\nline two\u0000'
    submission.report.feedback = feedback

    const payload = prepareSubmissionPayload(submission)

    expect(payload.bytes).toEqual(Buffer.from(`${JSON.stringify(payload.submission, null, 2)}\n`, 'utf8'))
    expect(payload.submission.report.feedback).toBe(feedback)
    expect(JSON.parse(payload.bytes.toString())).toEqual(payload.submission)
  })

  test.each([null, '', '  \n  '])('normalizes absent or empty feedback %j to null', (feedback) => {
    const submission = submissionFixture()
    submission.report.feedback = feedback

    const payload = prepareSubmissionPayload(submission)

    expect(payload.submission.report.feedback).toBeNull()
    expect(payload.bytes.toString()).toContain('"feedback": null')
  })
})
