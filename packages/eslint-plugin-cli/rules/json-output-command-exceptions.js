// Exceptions to the typed JSON output requirement, listed by repository-relative command path.
const commandExceptions = [
  // Existing finite commands awaiting migration. Remove entries as they adopt typed JSON output.
  // Do not add new finite commands to this section.
  'packages/plugin-did-you-mean/src/commands/config/autocorrect/off.ts',
  'packages/plugin-did-you-mean/src/commands/config/autocorrect/on.ts',
  'packages/plugin-did-you-mean/src/commands/config/autocorrect/status.ts',
  'packages/theme/src/cli/commands/theme/metafields/pull.ts',

  // App Security commands, launched before adopting typed JSON output. Remove entries as they adopt it.
  'packages/app/src/cli/commands/app/security/check.ts',
  'packages/app/src/cli/commands/app/security/clean.ts',
  'packages/app/src/cli/commands/app/security/instructions.ts',
  'packages/app/src/cli/commands/app/security/record.ts',
  'packages/app/src/cli/commands/app/security/review.ts',

  // Streaming commands without a single finite result.
  'packages/app/src/cli/commands/app/dev.ts',
  'packages/app/src/cli/commands/app/graphiql.ts',
  'packages/app/src/cli/commands/app/logs.ts',
  'packages/store/src/cli/commands/store/graphiql.ts',
  'packages/theme/src/cli/commands/theme/console.ts',
  'packages/theme/src/cli/commands/theme/dev.ts',
  'packages/theme/src/cli/commands/theme/language-server.ts',
]

module.exports = {commandExceptions}
