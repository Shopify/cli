import {renderSecurityReviewResult} from './result.js'
import {reviewAppSecurityResults, type ReviewedAppSecurityResults} from '../security-review.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {resolveAppSecurityCommands} from '../app-security-commands.js'
import {appSecurityResultsFor} from '../app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from '../app-security-engine/tests/fixtures/findings-documents.js'
import {unstyled} from '@shopify/cli-kit/node/output'
import {cwd} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test} from 'vitest'
import type {AppSecurityBlockingLevel} from '../app-security-api.js'
import type {AppSecuritySelection} from '../app-security-selection.js'

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
})

const appRoot = '/tmp/review-app'
const selection: AppSecuritySelection = {
  kind: 'config',
  appDirectory: appRoot,
  appConfigFilePath: `${appRoot}/shopify.app.toml`,
}

function reviewed(options: {blocking?: AppSecurityBlockingLevel} = {}): ReviewedAppSecurityResults {
  const results = appSecurityResultsFor(appRoot, 'shopify.app', {
    deterministic: deterministicFindingsDocument,
    agent: agentFindingsDocument,
  })
  return {
    result: reviewAppSecurityResults(results, {
      resultsDirectory: appSecurityArtifactPaths(appRoot, 'shopify.app').resultsDirectory,
      checkIds: [],
      blocking: options.blocking ?? 'none',
    }),
    commands: resolveAppSecurityCommands(selection, cwd()),
  }
}

describe('renderSecurityReviewResult', () => {
  test('renders the review in the terminal and leaves the exit code alone', () => {
    process.exitCode = undefined
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReviewResult(reviewed(), {verbose: false})

    const rendered = unstyled(output.output())
    expect(rendered).toContain('3 checks with findings. 1 check unresolved.')
    expect(rendered).toContain('Next steps')
    expect(rendered).not.toContain('Suppressed:')
    expect(process.exitCode).toBeUndefined()
  })

  test('shows suppressed findings in full with --verbose', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReviewResult(reviewed(), {verbose: true})

    expect(unstyled(output.output())).toContain('Suppressed: The route is restricted to the app owner')
  })

  test('renders the Blocking section and sets exit code 1 when --blocking is breached', () => {
    process.exitCode = undefined
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReviewResult(reviewed({blocking: 'high'}), {verbose: false})

    expect(unstyled(output.error())).toContain('2 checks at or above high (--blocking high).')
    expect(process.exitCode).toBe(1)
  })
})
