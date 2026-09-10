import {detectedAgentEnvironmentVariables} from './agent.js'
import {determineAgent, type KnownAgentNames} from '@vercel/detect-agent'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@vercel/detect-agent')
vi.mock('../../../public/node/output.js')

const {determineAgent: realDetermineAgent} =
  await vi.importActual<typeof import('@vercel/detect-agent')>('@vercel/detect-agent')

function agentDetected(name: string) {
  vi.mocked(determineAgent).mockResolvedValue({isAgent: true, agent: {name: name as KnownAgentNames}})
}

function noAgentDetected() {
  vi.mocked(determineAgent).mockResolvedValue({isAgent: false, agent: undefined})
}

const declaredAgentVariableNames = ['SHOPIFY_CLI_AGENT_INFO', 'SHOPIFY_CLI_AGENT_IDS']

const legacyAgentVariableNames = [
  'SHOPIFY_CLI_AGENT',
  'SHOPIFY_CLI_AGENT_VERSION',
  'SHOPIFY_CLI_AGENT_RUN_ID',
  'SHOPIFY_CLI_AGENT_SESSION_ID',
  'SHOPIFY_CLI_AGENT_PROVIDER',
]

const agentVariableNamesReadByTheDependency = [
  'AI_AGENT',
  'CURSOR_TRACE_ID',
  'CURSOR_AGENT',
  'CURSOR_EXTENSION_HOST_ROLE',
  'GEMINI_CLI',
  'CODEX_SANDBOX',
  'CODEX_CI',
  'CODEX_THREAD_ID',
  'ANTIGRAVITY_AGENT',
  'AUGMENT_AGENT',
  'OPENCODE_CLIENT',
  'CLAUDECODE',
  'CLAUDE_CODE',
  'CLAUDE_CODE_IS_COWORK',
  'REPL_ID',
  'COPILOT_MODEL',
  'COPILOT_ALLOW_ALL',
  'COPILOT_GITHUB_TOKEN',
]

function stubDeclaredAgentVariablesEmpty() {
  declaredAgentVariableNames.forEach((variableName) => vi.stubEnv(variableName, undefined))
}

// This host is often itself an agent session, and `AI_AGENT` outranks the rest of what the dependency reads.
function useRealDetectionWithCleanEnvironment() {
  vi.mocked(determineAgent).mockImplementation(realDetermineAgent)
  stubDeclaredAgentVariablesEmpty()
  agentVariableNamesReadByTheDependency.forEach((variableName) => vi.stubEnv(variableName, undefined))
}

describe('detectedAgentEnvironmentVariables', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('reports nothing when SHOPIFY_CLI_AGENT_INFO was declared, so a guess cannot clobber it', async () => {
    agentDetected('claude')

    const got = await detectedAgentEnvironmentVariables({
      SHOPIFY_CLI_AGENT_INFO: 'n:shopify-ai-toolkit|v:1.0.0|p:anthropic|m:claude-opus-5',
    })

    expect(got).toEqual({})
  })

  test('reports nothing when SHOPIFY_CLI_AGENT_IDS was declared', async () => {
    agentDetected('claude')

    const got = await detectedAgentEnvironmentVariables({SHOPIFY_CLI_AGENT_IDS: 's:session-id|r:run-id'})

    expect(got).toEqual({})
  })

  test('leaves a declared SHOPIFY_CLI_AGENT_INFO value untouched', async () => {
    agentDetected('claude')
    const env = {SHOPIFY_CLI_AGENT_INFO: 'n:shopify-ai-toolkit|v:1.0.0'}

    await detectedAgentEnvironmentVariables(env)

    expect(env).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:shopify-ai-toolkit|v:1.0.0'})
  })

  test.each(legacyAgentVariableNames)(
    'reports the detected agent when only the legacy %s was declared',
    async (declaredVariableName) => {
      agentDetected('devin')

      const got = await detectedAgentEnvironmentVariables({[declaredVariableName]: 'declared-by-the-producer'})

      expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin', SHOPIFY_CLI_AGENT_DETECTED: 'true'})
    },
  )

  test('reports the detected agent when only SHOPIFY_INVOKED_BY was declared', async () => {
    agentDetected('devin')

    const got = await detectedAgentEnvironmentVariables({SHOPIFY_INVOKED_BY: 'shopify-ai-toolkit'})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin', SHOPIFY_CLI_AGENT_DETECTED: 'true'})
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

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin', SHOPIFY_CLI_AGENT_DETECTED: 'true'})
  })

  test('reports the detected agent and a marker when nothing was declared', async () => {
    agentDetected('devin')

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devin', SHOPIFY_CLI_AGENT_DETECTED: 'true'})
  })

  test('reports nothing when no agent is detected', async () => {
    noAgentDetected()

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({})
  })

  test.each([
    ['claude', 'claude-code'],
    ['gemini', 'gemini-cli'],
  ])('reports the detected name %s using the toolkit name %s', async (detectedName, expectedName) => {
    agentDetected(detectedName)

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: `n:${expectedName}`, SHOPIFY_CLI_AGENT_DETECTED: 'true'})
  })

  test.each([
    ['a known name needing no translation', 'cursor'],
    ['an arbitrary AI_AGENT pass-through value', 'claude-code_2-1-267_agent'],
  ])('reports %s verbatim', async (_description, detectedName) => {
    agentDetected(detectedName)

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: `n:${detectedName}`, SHOPIFY_CLI_AGENT_DETECTED: 'true'})
  })

  test('strips the tag separator from the detected name so it cannot inject tags', async () => {
    agentDetected('devin|v:9.9.9')

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:devinv:9.9.9', SHOPIFY_CLI_AGENT_DETECTED: 'true'})
  })

  test.each([
    ['whitespace-only', '   '],
    ['nothing but the tag separator', '|'],
  ])('reports nothing when the detected name is %s', async (_description, detectedName) => {
    agentDetected(detectedName)

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({})
  })

  test('reports nothing when detection fails', async () => {
    vi.mocked(determineAgent).mockRejectedValue(new Error('EACCES: permission denied, stat /opt/.devin'))

    const got = await detectedAgentEnvironmentVariables({})

    expect(got).toEqual({})
  })

  test('does not mutate process.env when reporting a detected agent', async () => {
    agentDetected('claude')
    stubDeclaredAgentVariablesEmpty()
    const environmentBefore = {...process.env}

    const got = await detectedAgentEnvironmentVariables()

    expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:claude-code', SHOPIFY_CLI_AGENT_DETECTED: 'true'})
    expect({...process.env}).toEqual(environmentBefore)
  })

  describe('against the real dependency', () => {
    test('reports an arbitrary AI_AGENT value verbatim', async () => {
      useRealDetectionWithCleanEnvironment()
      vi.stubEnv('AI_AGENT', 'claude-code_2-1-267_agent')

      const got = await detectedAgentEnvironmentVariables()

      expect(got).toEqual({
        SHOPIFY_CLI_AGENT_INFO: 'n:claude-code_2-1-267_agent',
        SHOPIFY_CLI_AGENT_DETECTED: 'true',
      })
    })

    // The dependency reports bare `claude`; only driving it for real proves the map matches its vocabulary.
    test('reports a CLAUDECODE environment using the toolkit name', async () => {
      useRealDetectionWithCleanEnvironment()
      vi.stubEnv('CLAUDECODE', '1')

      const got = await detectedAgentEnvironmentVariables()

      expect(got).toEqual({SHOPIFY_CLI_AGENT_INFO: 'n:claude-code', SHOPIFY_CLI_AGENT_DETECTED: 'true'})
    })

    test('reports nothing when a declaration exists, whatever the dependency would detect', async () => {
      useRealDetectionWithCleanEnvironment()
      vi.stubEnv('CLAUDECODE', '1')
      vi.stubEnv('SHOPIFY_CLI_AGENT_IDS', 's:session-id')

      const got = await detectedAgentEnvironmentVariables()

      expect(got).toEqual({})
    })
  })
})
