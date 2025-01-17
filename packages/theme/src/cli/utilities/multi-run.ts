/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
import {ensureThemeStore} from './theme-store.js'
import {list} from '../services/list.js'
import {push, PushFlags} from '../services/push.js'
import {pull, PullFlags} from '../services/pull.js'
import {loadEnvironment, validateEnvironmentConfig} from '@shopify/cli-kit/node/environments'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

// Base interface for common flags
interface BaseFlags {
  store?: string
  json?: boolean
  environment?: string[]
  password?: string
  'no-color': boolean
  verbose: boolean
  [key: string]: unknown
}

// Command-specific flag interfaces
interface CommandFlags {
  list: BaseFlags
  push: BaseFlags & PushFlags
  pull: BaseFlags & PullFlags
}

type SupportedCommands = keyof CommandFlags

interface MultiRunOptions<T extends SupportedCommands> {
  flags: CommandFlags[T]
  additionalRequiredFlags?: string[]
  command: T
}

// Command list for import
async function runCommand<T extends SupportedCommands>(session: AdminSession, flags: CommandFlags[T], command: T) {
  switch (command) {
    case 'list':
      await list(session, flags as {json: boolean})
      break
    case 'push':
      await push(flags as PushFlags, session)
      break
    case 'pull':
      await pull(flags as PullFlags, session)
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

export async function multiRun<T extends SupportedCommands>({
  flags,
  additionalRequiredFlags,
  command,
}: MultiRunOptions<T>) {
  if (!flags.environment?.length) {
    return
  }

  // Authenticate all sessions
  const sessions: {[key: string]: AdminSession} = {}
  for (const env of flags.environment) {
    const envConfig = await loadEnvironment(env, 'shopify.theme.toml')
    const store = ensureThemeStore({store: envConfig?.store as any})
    sessions[env] = await ensureAuthenticatedThemes(store, envConfig?.password as any)
  }

  // Concurrently run commands
  await Promise.all(
    flags.environment.map(async (env) => {
      const envConfig = await loadEnvironment(env, 'shopify.theme.toml')
      const envFlags = {
        ...flags,
        ...envConfig,
        environment: [env],
      } as CommandFlags[T]

      const valid = validateEnvironmentConfig(envConfig, {
        additionalRequiredFlags,
      })
      if (!valid) {
        return
      }

      const session = sessions[env]
      if (!session) {
        throw new Error(`No session found for environment ${env}`)
      }

      await runCommand(session, envFlags, command)
    }),
  )
}
