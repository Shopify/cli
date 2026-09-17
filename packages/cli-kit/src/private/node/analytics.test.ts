import {getSensitiveEnvironmentData} from './analytics.js'
import {determineAgent, type KnownAgentNames} from '@vercel/detect-agent'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@vercel/detect-agent')
vi.mock('../../public/node/output.js')

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

// Only `config.plugins.keys()` is read, so an empty plugin map is enough.
const config = {plugins: new Map()} as any

async function shopifyEnvironmentVariables() {
  const {env_shopify_variables: shopifyVariables} = await getSensitiveEnvironmentData(config)
  return JSON.parse(shopifyVariables)
}

describe('getSensitiveEnvironmentData', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('adds detected agent variables when explicit attribution is missing', async () => {
    agentDetected('claude')
    stubDeclaredAgentVariablesEmpty()

    const got = await shopifyEnvironmentVariables()

    expect(got).toMatchObject({SHOPIFY_CLI_AGENT_INFO: 'n:claude-code', SHOPIFY_CLI_AGENT_DETECTION: 'detected'})
  })

  test('does not add a detected agent to the payload when only SHOPIFY_CLI_AGENT_INFO is declared', async () => {
    agentDetected('claude')
    vi.stubEnv('SHOPIFY_CLI_AGENT_INFO', 'n:cursor|v:2.1.0|p:openai|m:gpt-5')
    vi.stubEnv('SHOPIFY_CLI_AGENT_IDS', undefined)

    const got = await shopifyEnvironmentVariables()

    expect(got).toMatchObject({
      SHOPIFY_CLI_AGENT_INFO: 'n:cursor|v:2.1.0|p:openai|m:gpt-5',
      SHOPIFY_CLI_AGENT_DETECTION: 'skipped',
    })
  })

  test('does not fail telemetry if determineAgent throws an error, and reports the failure', async () => {
    vi.mocked(determineAgent).mockRejectedValue(new Error('EACCES: permission denied'))
    stubDeclaredAgentVariablesEmpty()

    const got = await shopifyEnvironmentVariables()

    expect(got).not.toHaveProperty('SHOPIFY_CLI_AGENT_INFO')
    expect(got).toMatchObject({SHOPIFY_CLI_AGENT_DETECTION: 'failed'})
  })

  test('reports none when no agent is detected', async () => {
    noAgentDetected()
    stubDeclaredAgentVariablesEmpty()

    const got = await shopifyEnvironmentVariables()

    expect(got).toMatchObject({SHOPIFY_CLI_AGENT_DETECTION: 'none'})
  })
})
