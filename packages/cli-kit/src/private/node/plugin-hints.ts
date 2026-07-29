// This module is imported statically from the prerun hook, which runs before the CLI's
// heavy modules load. Keep it dependency-free (isTruthy has no imports) so it adds no
// measurable startup cost.
import {isTruthy} from '../../public/node/context/utilities.js'

/** The Claude Code plugin hint protocol marker. */
export const SHOPIFY_AI_TOOLKIT_PLUGIN_HINT =
  '<claude-code-hint v="1" type="plugin" value="shopify-ai-toolkit@claude-plugins-official" />'

/**
 * Returns whether this process was launched by Claude Code.
 *
 * @param environment - Environment variables to inspect.
 * @returns Whether Claude Code environment markers are truthy.
 */
export function runningUnderClaudeCode(environment: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(environment.CLAUDECODE) || isTruthy(environment.CLAUDE_CODE_CHILD_SESSION)
}

/**
 * Emits the Claude Code plugin hint on every command invocation under Claude Code.
 * Claude Code handles deduplication and persistence.
 *
 * @param environment - Environment variables to inspect.
 */
export function emitClaudeCodePluginHint(environment: NodeJS.ProcessEnv = process.env): void {
  if (!runningUnderClaudeCode(environment)) return

  // stderr.write doesn't throw synchronously on supported Node versions; stream failures
  // surface as async 'error' events that a try/catch here couldn't intercept anyway.
  process.stderr.write(`${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
}
