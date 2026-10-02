/* eslint-disable no-restricted-imports -- package integration uses real temporary app directories */
import {createAppSecurityEngine} from '../run.js'
import {combineFindings, activeFindings} from '../results/combine.js'
import {loadChecks} from '../checks/index.js'
import {getRegistry} from '../registry/index.js'
import {defaultCheckSet, type AppSecurityCheckSet} from '../check-set.js'
import {describe, expect, test} from 'vitest'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const replacement: AppSecurityCheckSet = {
  contractVersion: 1,
  catalog: [
    {
      id: 'POC_CHECK',
      severity: 'high',
      title: 'POC check',
      description: 'Replacement package fixture',
      points: -20,
      fix: 'Update the configuration',
    },
  ],
  deterministic: [
    {
      id: 'POC_CHECK',
      version: 1,
      lifecycle: 'active',
      analysisMode: 'structured_config',
      target: 'config',
      runner: (context) => [
        {
          id: 'POC_CHECK',
          severity: 'high',
          points: -20,
          title: 'Replacement ran',
          message: 'Replacement finding',
          location: {file: 'shopify.app.toml', line: 1},
          fix: {automated: false, description: 'Update the configuration'},
          snippet: String(context.appToml?.raw.name),
        },
      ],
    },
  ],
  agentSources: ['---\nid: POC_CHECK\nversion: 1\nseverity: high\n---\nInspect the configuration trust boundary.\n'],
}

async function withApp(work: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'app-security-check-set-'))
  try {
    await writeFile(join(directory, 'shopify.app.toml'), 'name = "Fixture"\napplication_url = "https://example.com"\n')
    await work(directory)
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
}

describe('replaceable check sets', () => {
  test('uses the replacement for scanning, agent checks, registry, recording and combined review', async () => {
    await withApp(async (directory) => {
      const engine = createAppSecurityEngine(replacement)
      const initial = await engine.scanApp(directory)
      expect(initial.scan.issues.map((issue) => issue.id)).toEqual(['POC_CHECK'])
      expect(initial.scan.scan.checks_executed.map((check) => check.id)).toEqual(['POC_CHECK'])
      expect(initial.agentChecks.checks.map((check) => check.id)).toEqual(['POC_CHECK'])
      expect(initial.deterministicFindings.checks.map((check) => check.id)).toEqual(['POC_CHECK'])
      expect(initial.deterministicFindings.checks[0]!.snapshot.title).toBe('POC check')
      expect(getRegistry(replacement).map((check) => check.id)).toEqual(['POC_CHECK', 'POC_CHECK'])
      const prompt = loadChecks(replacement.agentSources).get('POC_CHECK')!
      const recorded = engine.recordAgentFindings(
        {
          schema_version: 1,
          checks_executed: [{check_id: prompt.id, check_version: prompt.version, status: 'executed'}],
          findings: [
            {
              check_id: prompt.id,
              check_version: prompt.version,
              file: 'shopify.app.toml',
              line: 1,
              message: 'Verified replacement finding',
              evidence: [{file: 'shopify.app.toml', line: 1, quote: 'name = "Fixture"'}],
            },
          ],
        },
        {engineVersion: initial.engine.version, project: initial.scan.project},
      )
      expect(recorded.ok).toBe(true)
      if (!recorded.ok) throw new Error(recorded.errors.join('\n'))
      expect(recorded.document.checks.map((check) => check.id)).toEqual(['POC_CHECK'])
      expect(recorded.document.checks[0]!.snapshot.title).toBe('POC check')
      const reviewed = combineFindings({deterministic: initial.deterministicFindings, agent: recorded.document})
      expect(reviewed.map((check) => check.id)).toEqual(['POC_CHECK'])
      expect(
        activeFindings(reviewed[0]!)
          .map((finding) => finding.source)
          .sort(),
      ).toEqual(['agent', 'deterministic'])
    })
  })

  test('keeps upstream agent precedence when a replacement prefers agent results', async () => {
    await withApp(async (directory) => {
      const preferred = {
        ...replacement,
        agentSources: [
          replacement.agentSources[0]!.replace('severity: high', 'severity: high\nprecedence: prefer-agent'),
        ],
      }
      const engine = createAppSecurityEngine(preferred)
      const initial = await engine.scanApp(directory)
      const recorded = engine.recordAgentFindings(
        {
          schema_version: 1,
          checks_executed: [{check_id: 'POC_CHECK', check_version: 1, status: 'executed'}],
          findings: [],
        },
        {engineVersion: initial.engine.version, project: initial.scan.project},
      )
      if (!recorded.ok) throw new Error(recorded.errors.join('\n'))
      const reviewed = combineFindings({deterministic: initial.deterministicFindings, agent: recorded.document})
      expect(activeFindings(reviewed[0]!)).toEqual([])
    })
  })

  test('does not leak a replacement into a different engine instance', async () => {
    await withApp(async (directory) => {
      const [custom, standard] = await Promise.all([
        createAppSecurityEngine(replacement).scanApp(directory),
        createAppSecurityEngine(defaultCheckSet).scanApp(directory),
      ])
      expect(custom.agentChecks.checks.map((check) => check.id)).toEqual(['POC_CHECK'])
      expect(standard.agentChecks.checks.some((check) => check.id === 'POC_CHECK')).toBe(false)
    })
  })

  test('supports an agent-only replacement and recording without a previous scan', async () => {
    const engine = createAppSecurityEngine({...replacement, deterministic: []})
    const recorded = engine.recordAgentFindings(
      {
        schema_version: 1,
        checks_executed: [{check_id: 'POC_CHECK', check_version: 1, status: 'executed'}],
        findings: [],
      },
      {engineVersion: 'poc', project: {commit: null, dirty: null}},
    )
    expect(recorded.ok).toBe(true)
    if (!recorded.ok) throw new Error(recorded.errors.join('\n'))
    expect(recorded.document.checks.map((check) => check.id)).toEqual(['POC_CHECK'])
    await withApp(async (directory) => {
      const result = await engine.scanApp(directory)
      expect(result.deterministicFindings.checks).toEqual([])
      expect(result.agentChecks.checks.map((check) => check.id)).toEqual(['POC_CHECK'])
    })
  })

  test('keeps host redaction active for replacement detector output', async () => {
    await withApp(async (directory) => {
      const secret = ['shpat_', 'a'.repeat(32)].join('')
      const alternate: AppSecurityCheckSet = {
        ...replacement,
        deterministic: [
          {
            ...replacement.deterministic[0]!,
            runner: () => [
              {
                id: 'POC_CHECK',
                severity: 'high',
                points: -20,
                title: secret,
                message: secret,
                location: {file: 'shopify.app.toml'},
                fix: {automated: false, description: secret},
                snippet: secret,
              },
            ],
          },
        ],
      }
      const result = await createAppSecurityEngine(alternate).scanApp(directory)
      expect(JSON.stringify(result)).not.toContain(secret)
      expect(result.deterministicFindings.checks[0]!.findings[0]!.message).toContain('[REDACTED:')
    })
  })

  test('rejects incompatible contracts, duplicate IDs and orphan runners before running them', () => {
    expect(() => getRegistry({...replacement, contractVersion: 2} as unknown as AppSecurityCheckSet)).toThrow(
      'contract version',
    )
    expect(() =>
      getRegistry({...replacement, deterministic: [...replacement.deterministic, ...replacement.deterministic]}),
    ).toThrow('Duplicate deterministic')
    expect(() => getRegistry({...replacement, catalog: []})).toThrow('Orphan deterministic')
  })
})
