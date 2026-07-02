import {homeDirectory} from './context/local.js'
import {fileExists, readFile, readdir} from './fs.js'
import {joinPath} from './path.js'
import {outputInfo} from './output.js'

/**
 * The AI coding agent harnesses that the CLI knows how to detect.
 */
export type AIAgentHarness = 'pi' | 'claude-code' | 'codex'

interface HarnessDefinition {
  /**
   * Human friendly name of the harness, used in messaging.
   */
  name: string
  /**
   * The environment variable that, when present, indicates the harness is running the command.
   */
  envVar: string
  /**
   * The shell command that installs the Shopify AI Toolkit for this harness.
   */
  installCommand: string
  /**
   * Returns true if the Shopify AI Toolkit is already installed for this harness.
   */
  isInstalled: () => Promise<boolean>
}

async function directoryEntries(path: string): Promise<string[]> {
  if (!(await fileExists(path))) return []
  try {
    return await readdir(path)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return []
  }
}

async function fileContains(path: string, needle: string): Promise<boolean> {
  if (!(await fileExists(path))) return false
  try {
    const content = await readFile(path)
    return content.includes(needle)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

async function isPiToolkitInstalled(): Promise<boolean> {
  // The AI Toolkit isn't distributed as a Pi plugin. For Pi, it's installed as a set of
  // agent skills (e.g. via `npx skills add Shopify/shopify-ai-toolkit`), which are symlinked
  // or copied into ~/.pi/agent/skills using the `shopify-` prefix.
  const skillsDirectory = joinPath(homeDirectory(), '.pi', 'agent', 'skills')
  const entries = await directoryEntries(skillsDirectory)
  return entries.some((entry) => entry.startsWith('shopify-'))
}

async function isClaudeCodeToolkitInstalled(): Promise<boolean> {
  const installedPluginsFile = joinPath(homeDirectory(), '.claude', 'plugins', 'installed_plugins.json')
  if (await fileContains(installedPluginsFile, 'shopify')) return true

  // Fall back to checking the plugin download cache in case the installed plugins manifest
  // doesn't exist or uses a different shape than expected.
  const cacheDirectory = joinPath(homeDirectory(), '.claude', 'plugins', 'cache')
  const marketplaces = await directoryEntries(cacheDirectory)
  for (const marketplace of marketplaces) {
    // eslint-disable-next-line no-await-in-loop
    const plugins = await directoryEntries(joinPath(cacheDirectory, marketplace))
    if (plugins.some((plugin) => plugin.includes('shopify'))) return true
  }
  return false
}

async function isCodexToolkitInstalled(): Promise<boolean> {
  const configFile = joinPath(homeDirectory(), '.codex', 'config.toml')
  if (await fileContains(configFile, 'shopify')) return true

  // Fall back to checking the plugin download cache in case config.toml doesn't reference
  // the plugin directly.
  const cacheDirectory = joinPath(homeDirectory(), '.codex', 'plugins', 'cache')
  const marketplaces = await directoryEntries(cacheDirectory)
  for (const marketplace of marketplaces) {
    // eslint-disable-next-line no-await-in-loop
    const plugins = await directoryEntries(joinPath(cacheDirectory, marketplace))
    if (plugins.some((plugin) => plugin.includes('shopify'))) return true
  }
  return false
}

const harnessDefinitions: {[harness in AIAgentHarness]: HarnessDefinition} = {
  pi: {
    name: 'Pi',
    envVar: 'PI_CODING_AGENT',
    installCommand: 'npx skills add Shopify/shopify-ai-toolkit',
    isInstalled: isPiToolkitInstalled,
  },
  'claude-code': {
    name: 'Claude Code',
    envVar: 'CLAUDE_CODE',
    installCommand: 'claude plugin install shopify-ai-toolkit@claude-plugins-official',
    isInstalled: isClaudeCodeToolkitInstalled,
  },
  codex: {
    name: 'Codex',
    envVar: 'CODEX_THREAD_ID',
    installCommand: 'codex plugin add shopify@openai-curated',
    isInstalled: isCodexToolkitInstalled,
  },
}

/**
 * Detects which AI coding agent harness (if any) is running the current process, based on
 * well-known environment variables set by each harness.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns The detected harness, or undefined if none was detected.
 */
export function detectAIAgentHarness(env = process.env): AIAgentHarness | undefined {
  return (Object.keys(harnessDefinitions) as AIAgentHarness[]).find((harness) => {
    const value = env[harnessDefinitions[harness].envVar]
    return value !== undefined && value !== ''
  })
}

/**
 * Returns true if the CLI is likely being driven by an AI coding agent rather than a human in
 * an interactive terminal. This is a best-effort heuristic based on the absence of a TTY
 * combined with the presence of a known agent harness environment variable.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if the current process appears to be running inside an AI coding agent.
 */
export function isRunningInsideAIAgent(env = process.env): boolean {
  return !process.stdout.isTTY && detectAIAgentHarness(env) !== undefined
}

/**
 * Checks whether the Shopify AI Toolkit is installed for the given harness.
 *
 * @param harness - The AI agent harness to check.
 * @returns True if the toolkit appears to be installed.
 */
export async function isAIToolkitInstalled(harness: AIAgentHarness): Promise<boolean> {
  try {
    return await harnessDefinitions[harness].isInstalled()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Returns the shell command an AI agent should run to install the Shopify AI Toolkit for the
 * given harness.
 *
 * @param harness - The AI agent harness.
 * @returns The install command for the harness.
 */
export function aiToolkitInstallCommand(harness: AIAgentHarness): string {
  return harnessDefinitions[harness].installCommand
}

/**
 * Returns the human-friendly display name for a harness.
 *
 * @param harness - The AI agent harness.
 * @returns The display name for the harness.
 */
export function aiAgentHarnessName(harness: AIAgentHarness): string {
  return harnessDefinitions[harness].name
}

/**
 * If the current process appears to be running inside a known AI coding agent and the Shopify
 * AI Toolkit isn't installed for that agent, prints a message telling the agent how to install
 * it. This is a no-op when running interactively, when no known harness is detected, or when the
 * toolkit is already installed.
 *
 * @param env - The environment variables from the environment of the current process.
 */
export async function suggestAIToolkitInstallIfNeeded(env = process.env): Promise<void> {
  if (!isRunningInsideAIAgent(env)) return

  const harness = detectAIAgentHarness(env)
  if (!harness) return

  if (await isAIToolkitInstalled(harness)) return

  outputInfo(
    `This command is running inside ${aiAgentHarnessName(harness)}. For better results when working with Shopify APIs, install the Shopify AI Toolkit by running \`${aiToolkitInstallCommand(
      harness,
    )}\`. Learn more: https://shopify.dev/docs/apps/build/ai-toolkit`,
  )
}
