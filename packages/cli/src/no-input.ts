import {noInputFlag} from '@shopify/cli-kit/node/no-input'

interface CommandWithBaseFlags {
  baseFlags?: Record<string, unknown>
}

export function addNoInputFlag<T>(command: T): T {
  if (typeof command !== 'function') return command

  const commandWithBaseFlags = command as CommandWithBaseFlags
  commandWithBaseFlags.baseFlags = {...noInputFlag, ...commandWithBaseFlags.baseFlags}
  return command
}
