import securityReview from './security-review.js'
import {resolveAppSecurityRoot} from './app-security-api.js'
import {appSecurityArtifactPaths, readAgentFindings, readDeterministicFindings} from './app-security-artifacts.js'
import {submissionScanFixture} from './app-security-engine/tests/fixtures/submission-scan.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {SecurityReviewDependencies} from './security-review.js'
import type {AppSecurityArtifactPaths} from './app-security-artifacts.js'
import type {AgentFindingsArtifact, DeterministicFindingsDocument} from './app-security-engine/index.js'

const scan: DeterministicFindingsDocument = {...submissionScanFixture, generated_at: '2026-01-01T00:00:00.000Z'}

const agentFindings: AgentFindingsArtifact = {
  schema_version: 1,
  engine: {name: 'shopify-app-security', version: '3.99.0'},
  recorded_at: '2026-01-01T02:00:00.000Z',
  project: {commit: 'abc123', dirty: false},
  checks: [],
}

async function createApp(
  directory: string,
  files: {scan?: string; agentFindings?: string} = {},
): Promise<AppSecurityArtifactPaths> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const paths = appSecurityArtifactPaths(directory)
  await mkdir(paths.artifactDirectory)
  if (files.scan !== undefined) await writeFile(paths.deterministicFindingsPath, files.scan)
  if (files.agentFindings !== undefined) await writeFile(paths.agentFindingsPath, files.agentFindings)
  return paths
}

function testDependencies(): SecurityReviewDependencies {
  return {
    resolveRoot: resolveAppSecurityRoot,
    readDeterministicFindings,
    readAgentFindings,
    output: vi.fn(),
    now: () => new Date('2026-01-01T02:03:00.000Z'),
  }
}

async function review(directory: string, json: boolean): Promise<string> {
  const dependencies = testDependencies()
  await securityReview({directory, json}, dependencies)
  expect(dependencies.output).toHaveBeenCalledTimes(1)
  return vi.mocked(dependencies.output).mock.calls[0]![0]
}

describe('securityReview', () => {
  test('shows both files with their paths, ages, and contents', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = await createApp(directory, {
        scan: JSON.stringify(scan),
        agentFindings: JSON.stringify(agentFindings),
      })

      const output = await review(directory, false)

      expect(output).toContain(
        `Deterministic findings: ${paths.deterministicFindingsPath} (generated 2 hours ago)\n${JSON.stringify(scan, null, 2)}`,
      )
      expect(output).toContain(
        `Agent findings: ${paths.agentFindingsPath} (recorded 3 minutes ago)\n${JSON.stringify(agentFindings, null, 2)}`,
      )
      expect(output.toLowerCase()).not.toContain('stale')
    })
  })

  test('prints both files as JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {scan: JSON.stringify(scan), agentFindings: JSON.stringify(agentFindings)})

      const output = await review(directory, true)

      expect(JSON.parse(output)).toEqual({deterministic_findings: scan, agent_findings: agentFindings})
    })
  })

  test('shows the record command when agent findings are missing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = await createApp(directory, {scan: JSON.stringify(scan)})

      const output = await review(directory, false)

      expect(output).toContain(`Deterministic findings: ${paths.deterministicFindingsPath} (generated 2 hours ago)`)
      expect(output).toMatch(
        new RegExp(
          `Agent findings: .*agent-findings\\.json\nnot found — run \`shopify app security record --path .* < <findings\\.json>\`$`,
        ),
      )
    })
  })

  test('prints null for a missing file in JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {agentFindings: JSON.stringify(agentFindings)})

      const output = await review(directory, true)

      expect(JSON.parse(output)).toEqual({deterministic_findings: null, agent_findings: agentFindings})
    })
  })

  test('shows the check and record commands when neither file exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      const output = await review(directory, false)

      expect(output).toMatch(
        /Deterministic findings: .*deterministic-findings\.json\nnot found — run `shopify app security check --path .*`/,
      )
      expect(output).toMatch(/Agent findings: .*agent-findings\.json\nnot found — run `shopify app security record /)
    })
  })

  test('prints null for both files in JSON when neither exists', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      const output = await review(directory, true)

      expect(JSON.parse(output)).toEqual({deterministic_findings: null, agent_findings: null})
    })
  })

  test('shows why a file is invalid', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = await createApp(directory, {
        scan: '{not json',
        agentFindings: JSON.stringify({...agentFindings, schema_version: 7}),
      })

      const output = await review(directory, false)

      expect(output).toContain(
        `Deterministic findings: ${paths.deterministicFindingsPath}\ninvalid — Could not parse JSON:`,
      )
      expect(output).toContain(
        `Agent findings: ${paths.agentFindingsPath}\ninvalid — unsupported schema_version: 7 (expected 1)`,
      )
    })
  })

  test('prints null for an invalid file in JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {scan: JSON.stringify(scan), agentFindings: '[]'})

      const output = await review(directory, true)

      expect(JSON.parse(output)).toEqual({deterministic_findings: scan, agent_findings: null})
    })
  })
})
