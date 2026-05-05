/**
 * Identifies which AI coding agent (if any) is invoking the current process.
 *
 * Mirrors the detection order from `~/Downloads/agent-env_vars` captures:
 * most-specific signals first, because some agents inherit other agents'
 * environment variables (Cursor inherits VSCODE_*; Claude Code, Codex, and
 * Gemini each have a parent signal shared by their flavors).
 *
 * This is a best-effort signal for telemetry and UX. Agents can spoof any of
 * these vars; do not gate security decisions on the result.
 */

export type CallingAgent =
  | 'PI'
  | 'CODEX'
  | 'CODEX_VSCODE'
  | 'CURSOR'
  | 'OPENCODE'
  | 'GEMINI'
  | 'GEMINI_VSCODE'
  | 'GITHUB_COPILOT_CLI'
  | 'CLAUDE_CODE'
  | 'CLAUDE_CODE_VSCODE'
  | 'OPENCLAW'
  | 'VSCODE_TERMINAL'
  | 'ZED_TERMINAL'
  | 'UNKNOWN'

/**
 * Returns the calling agent based on environment variables.
 *
 * @param env - Environment variables to inspect (defaults to `process.env`).
 * @returns The detected agent, or `'UNKNOWN'` when no signal matches.
 */
export function callingAgent(env: NodeJS.ProcessEnv = process.env): CallingAgent {
  if (env.PI_CODING_AGENT === 'true') return 'PI'

  if (env.CODEX_THREAD_ID) {
    return env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE === 'codex_vscode' ? 'CODEX_VSCODE' : 'CODEX'
  }

  if (env.CURSOR_AGENT === '1') return 'CURSOR'

  if (env.OPENCODE === '1') return 'OPENCODE'

  if (env.GEMINI_THREAD_ID || env.GEMINI_CLI === '1') {
    return env.GEMINI_INTERNAL_ORIGINATOR_OVERRIDE === 'gemini_vscode' ? 'GEMINI_VSCODE' : 'GEMINI'
  }

  if (env.COPILOT_CLI === '1') return 'GITHUB_COPILOT_CLI'

  if (env.CLAUDECODE === '1') {
    return env.CLAUDE_CODE_ENTRYPOINT === 'claude-vscode' ? 'CLAUDE_CODE_VSCODE' : 'CLAUDE_CODE'
  }

  if (env.OPENCLAW_SHELL) return 'OPENCLAW'

  if (env.TERM_PROGRAM === 'vscode') return 'VSCODE_TERMINAL'

  if (env.TERM_PROGRAM === 'zed' || env.ZED_TERM === 'true') return 'ZED_TERMINAL'

  return 'UNKNOWN'
}
