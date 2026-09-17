import {detectedAgentEnvironmentVariables} from './agent.js'
import {determineAgent, type KnownAgentNames} from '@vercel/detect-agent'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@vercel/detect-agent')
vi.mock('../../../public/node/output.js')

function agentDetected(name: string) {
  vi.mocked(determineAgent).mockResolvedValue({isAgent: true, agent: {name: name as KnownAgentNames}})
}

function noAgentDetected() {
  vi.mocked(determineAgent).mockResolvedValue({isAgent: false, agent: undefined})
}

const declaredAgentVariableNames = ['SHOPIFY_CLI_AGENT_INFO', 'SHOPIFY_CLI_AGENT_IDS']

function stubDeclaredAgentVariablesEmpty() {
  declaredAgentVariableNames.forEach((variableName) => vi.stubEnv(variableName, undefined))
}

describe('detectedAgentEnvironmentVariables', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('reports skipped when SHOPIFY_CLI_AGENT_INFO was declared, so a guess cannot clobber it', async () => {
    agentDetected('claude')

    const got = await detectedAgentEnvironmentVariables({
      SHOPIFY_CLI_AGENT_INFO: 'n:cursor|v:2.1.0|p:openai|m:gpt-5',
    })

    expect(got).toEqual({SHOPIFY_CLI_AGENT_DETECTION: 'skipped'})
  })

  test('reports skipped when SHOPIFY_CLI_AGENT_IDS was declared', async () => {
    agentDetected('claude')

    const got = await detectedAgentEnvironmentVariables({SHOPIFY_CLI_AGENT_IDS: 's:session-id|r:run-id'})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_DETECTION: 'skipped'})
  })

  test('leaves a declared SHOPIFY_CLI_AGENT_INFO value untouched', async () => {
    agentDetected('claude')
    const env = {SHOPIFY_CLI_AGENT_INFO: 'n:cursor|v:2.1.0'}

    await detectedAgentEnvironmentVariables(env)

    expect(env).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:cursor|v:2.1.0'})
  })

  test('a legacy declaration does not suppress detection', async () => {
    agentDetected('devin')

    const got = await detectedAgentEnvironmentVariables({SHOPIFY_CLI_AGENT: 'declared-by-the-producer'})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin', SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
  })

  test.each([
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('treats a %s declaration as absent and reports the detected agent', async (_description, declaredValue) => {
    agentDetected('devin')

    const got = await detectedAgentEnvironmentVariables({
      SHOPIFY_CLI_AGENT_INFO: declaredValue,
      SHOPIFY_CLI_AGENT_IDS: declaredValue,
    })

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin', SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
  })

  test('reports the detected agent when nothing was declared', async () => {
    agentDetected('devin')

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin', SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
  })

  test('reports none when no agent is detected', async () => {
    noAgentDetected()

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_DETECTION: 'none'})
  })

  test.each([
    ['claude', 'claude-code'],
    ['gemini', 'gemini-cli'],
  ])('reports the detected name %s using the toolkit name %s', async (detectedName, expectedName) => {
    agentDetected(detectedName)

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: `n:${expectedName}`, SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
  })

  test.each([
    ['a known name needing no translation', 'cursor'],
    ['an arbitrary AI_AGENT pass-through value', 'claude-code_2-1-267_agent'],
  ])('reports %s verbatim', async (_description, detectedName) => {
    agentDetected(detectedName)

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: `n:${detectedName}`, SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
  })

  test.each([['constructor'], ['toString'], ['__proto__']])(
    'reports the inherited object property name %s verbatim',
    async (detectedName) => {
      agentDetected(detectedName)

      const got = await detectedAgentEnvironmentVariables({})

      expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: `n:${detectedName}`, SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
    },
  )

  test('replaces the tag separator in the detected name so it cannot inject tags', async () => {
    agentDetected('devin|v:9.9.9')

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin_v:9.9.9', SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
  })

  test.each([
    ['whitespace-only', '   '],
    ['nothing but the tag separator', '|'],
    ['nothing but tag separators', '||'],
  ])('reports unusable_name when the detected name is %s', async (_description, detectedName) => {
    agentDetected(detectedName)

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_DETECTION: 'unusable_name'})
  })

  test('reports failed when detection fails', async () => {
    vi.mocked(determineAgent).mockRejectedValue(new Error('EACCES: permission denied, stat /opt/.devin'))

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_DETECTION: 'failed'})
  })

  test('does not mutate process.env when reporting a detected agent', async () => {
    agentDetected('claude')
    stubDeclaredAgentVariablesEmpty()
    const environmentBefore = {...process.env}

    const got = await detectedAgentEnvironmentVariables()

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:claude-code', SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
    expect({...process.env}).toEqual(environmentBefore)
  })
})
