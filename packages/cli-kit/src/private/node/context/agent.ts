import {outputDebug} from '../../../public/node/output.js'
import {determineAgent} from '@vercel/detect-agent'

const toolkitAgentNamesByDetectedName: {[detectedName: string]: string} = {
  claude: 'claude-code',
  gemini: 'gemini-cli',
}

const explicitAgentVariableNames = ['SHOPIFY_CLI_AGENT_INFO', 'SHOPIFY_CLI_AGENT_IDS']

function hasExplicitAgentAttribution(env: NodeJS.ProcessEnv): boolean {
  return explicitAgentVariableNames.some((variableName) => (env[variableName] ?? '').trim() !== '')
}

export async function detectedAgentEnvironmentVariables(
  env: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  // Emitting while a declaration exists would clobber the producer's whole packed value, not just the name.
  if (hasExplicitAgentAttribution(env)) return {}

  try {
    const detection = await determineAgent()
    if (!detection.isAgent) return {}

    // `|` separates tags, so a name containing one could otherwise inject tags nothing detected.
    const detectedName = detection.agent.name.replaceAll('|', '').trim()
    if (detectedName === '') return {}

    return {
      SHOPIFY_CLI_AGENT_INFO: `n:${toolkitAgentNamesByDetectedName[detectedName] ?? detectedName}`,
      SHOPIFY_CLI_AGENT_DETECTED: 'true',
    }

    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    let message = 'Unable to detect which AI agent is running the CLI'
    if (error instanceof Error) {
      message = message.concat(`: ${error.message}`)
    }
    outputDebug(message)
    return {}
  }
}
