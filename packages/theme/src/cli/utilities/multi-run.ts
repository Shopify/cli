/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
import {ensureThemeStore} from './theme-store.js'
import {PushFlags} from '../services/push.js'
import {PullFlags} from '../services/pull.js'
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
export interface CommandFlags {
  list: BaseFlags
  push: BaseFlags & PushFlags
  pull: BaseFlags & PullFlags
}

type SupportedCommands = keyof CommandFlags

interface MultiRunOptions<T extends SupportedCommands> {
  flags: CommandFlags[T]
  additionalRequiredFlags?: string[]
  command: (flags: CommandFlags[T], session: AdminSession) => Promise<void>
}

// export function isMultiEnv(flags: {environment: string[]}): boolean {
//   return flags.environment && flags.environment.length > 1
// }

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
  const environment = flags.environment
  for (const env of environment) {
    const envConfig = await loadEnvironment(env, 'shopify.theme.toml')
    const store = ensureThemeStore({store: envConfig?.store as any})
    sessions[env] = await ensureAuthenticatedThemes(store, envConfig?.password as any)
  }

  // Concurrently run commands
  await Promise.all(
    environment.map(async (env) => {
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

      await command(envFlags, session)
    }),
  )
}
