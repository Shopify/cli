import {outputDebug} from '../../../public/node/output.js'
import {determineAgent, KNOWN_AGENTS} from '@vercel/detect-agent'

const toolkitAgentNamesByDetectedName = new Map<string, string>([
  [KNOWN_AGENTS.CLAUDE, 'claude-code'],
  [KNOWN_AGENTS.GEMINI, 'gemini-cli'],
])

const explicitAgentVariableNames = ['SHOPIFY_CLI_AGENT_INFO', 'SHOPIFY_CLI_AGENT_IDS']

function hasExplicitAgentAttribution(env: NodeJS.ProcessEnv): boolean {
  return explicitAgentVariableNames.some((variableName) => (env[variableName] ?? '').trim() !== '')
}

type AgentDetectionState = 'skipped' | 'detected' | 'none' | 'unusable_name' | 'failed'

function agentDetectionResult(state: AgentDetectionState, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {...extra, SHOPIFY_CLI_AGENT_DETECTION: state}
}

export async function detectedAgentEnvironmentVariables(
  env: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  // Emitting while a declaration exists would clobber the producer's whole packed value, not just the name.
  if (hasExplicitAgentAttribution(env)) return agentDetectionResult('skipped')

  try {
    const detection = await determineAgent()
    if (!detection.isAgent) return agentDetectionResult('none')

    const rawDetectedName = detection.agent.name
    const nameHasContentBeyondSeparators = /[^|\s]/.test(rawDetectedName)
    // The name detection produced was real but unusable (nothing but separators/whitespace), which
    // is different from no agent being detected at all, so it gets its own state.
    if (!nameHasContentBeyondSeparators) return agentDetectionResult('unusable_name')

    // `|` separates tags, so a name containing one could otherwise fabricate tags we never detected.
    const detectedName = rawDetectedName.replaceAll('|', '_').trim()

    return agentDetectionResult('detected', {
      SHOPIFY_CLI_AGENT_INFO: `n:${toolkitAgentNamesByDetectedName.get(detectedName) ?? detectedName}`,
    })

    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Unable to detect which AI agent is running the CLI'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    outputDebug(message)
    return agentDetectionResult('failed')
  }
}
