// dev-mcp emits two things on stderr that would otherwise leak straight into our terminal (the MCP
// SDK's `StdioClientTransport` inherits the child's stderr and gives `@openai/agents`' `MCPServerStdio`
// no way to override that): a one-time startup banner, and a usage-telemetry line on every tool call.
// The telemetry is also gated behind `OPT_OUT_INSTRUMENTATION`, so opting out stops it being sent at
// all rather than merely hiding it. Since neither leak can be controlled from the transport layer, this
// wrapper re-spawns the real dev-mcp entry itself with its stderr discarded and that env var set, while
// transparently forwarding the JSON-RPC stdio channel dev-mcp actually talks over.
//
// Run via `node -e "<source>" <entry>`. Under `-e`, the eval string itself is never added to argv, so
// `process.argv[1]` is the first positional argument — the entry path — not `argv[2]`.
//
// The wrapper's own stdout/stderr are the JSON-RPC channel and our terminal respectively (the MCP SDK
// spawns *this* process the same inherited way), so it must never write to either itself: `stdio:
// ['inherit', 'inherit', 'ignore']` forwards stdin/stdout to the real dev-mcp process untouched and
// discards only its stderr, and a swallowed `child.on('error', ...)` stops a failed spawn from
// surfacing an uncaught-exception stack trace on our inherited stderr.
//
// The MCP SDK tears the wrapper down with SIGTERM when the transport closes; without forwarding that
// (and SIGINT) to the real dev-mcp process, it would be orphaned instead of exiting alongside us.
export const DEV_MCP_STDERR_SILENCER = `
const {spawn} = require('node:child_process')
const entry = process.argv[1]
const child = spawn(process.execPath, [entry], {
  stdio: ['inherit', 'inherit', 'ignore'],
  env: {...process.env, OPT_OUT_INSTRUMENTATION: 'true'},
})
const forwardSignal = (signal) => {
  try {
    child.kill(signal)
  } catch {}
}
process.on('SIGTERM', () => forwardSignal('SIGTERM'))
process.on('SIGINT', () => forwardSignal('SIGINT'))
child.on('error', () => process.exit(1))
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0))
`

/**
 * Builds the `command`/`args` pair that launches dev-mcp through the stderr-silencing wrapper above,
 * for use as `MCPServerStdio`'s spawn target instead of `node <entry>` directly.
 */
export function buildDevMcpLaunch(entry: string): {command: string; args: string[]} {
  return {command: process.execPath, args: ['-e', DEV_MCP_STDERR_SILENCER, entry]}
}
