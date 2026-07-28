import {getEnvironmentVariables} from './environment.js'
import {isTruthy} from './context/utilities.js'
import {outputDebug} from './output.js'

/** The Claude Code plugin hint protocol marker. */
export const SHOPIFY_AI_TOOLKIT_PLUGIN_HINT =
  '<claude-code-hint v="1" type="plugin" value="shopify-ai-toolkit@claude-plugins-official" />'

/**
 * Returns whether this process was launched by Claude Code.
 *
 * @param environment - Environment variables to inspect.
 * @returns Whether Claude Code environment markers are truthy.
 */
export function runningUnderClaudeCode(environment = getEnvironmentVariables()): boolean {
  return isTruthy(environment.CLAUDECODE) || isTruthy(environment.CLAUDE_CODE_CHILD_SESSION)
}

/**
 * Emits the Claude Code plugin hint on every invocation under Claude Code.
 * Claude Code handles deduplication and persistence. A failed optional integration
 * must not make the user's command fail.
 *
 * @param environment - Environment variables to inspect.
 */
export function emitClaudeCodePluginHint(environment = getEnvironmentVariables()): void {
  if (!runningUnderClaudeCode(environment)) return

  try {
    process.stderr.write(`${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`Unable to emit Claude Code plugin hint: ${(error as Error).message}`)
  }
}
