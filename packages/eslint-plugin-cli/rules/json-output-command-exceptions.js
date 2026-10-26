// Exceptions to the typed JSON output requirement, listed by repository-relative command path.
const commandExceptions = [
  // Existing finite commands awaiting migration. Remove entries as they adopt typed JSON output.
  // Do not add new finite commands to this section.

  // Streaming commands without a single finite result.
  'packages/app/src/cli/commands/app/dev.ts',
  'packages/app/src/cli/commands/app/graphiql.ts',
  'packages/app/src/cli/commands/app/logs.ts',
  'packages/store/src/cli/commands/store/graphiql.ts',
  'packages/theme/src/cli/commands/theme/console.ts',
  'packages/theme/src/cli/commands/theme/dev.ts',
  // Native LSP JSON-RPC owns stdin/stdout framing, IDs, notifications, cancellation, and shutdown.
  'packages/theme/src/cli/commands/theme/language-server.ts',
]

module.exports = {commandExceptions}
