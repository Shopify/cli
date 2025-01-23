/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
import {ensureThemeStore} from './theme-store.js'
import {PushFlags} from '../services/push.js'
import {PullFlags} from '../services/pull.js'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderWarning} from '@shopify/cli-kit/node/ui'

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

      outputInfo(session.storeFqdn)

      await command(envFlags, session)
    }),
  )
}

interface ValidateEnvironmentOptions {
  additionalRequiredFlags?: string[]
}

/**
 * Validates that required flags are present in the environment configuration.
 * @param environment - The environment configuration to validate.
 * @param options - Options for validation, including any additional required flags.
 * @returns True if valid, throws an error if invalid.
 */
export function validateEnvironmentConfig(environment: any, options?: ValidateEnvironmentOptions): boolean {
  if (!environment) {
    renderWarning({body: 'Environment configuration is empty.'})
    return false
  }

  const requiredFlags = ['store', 'password', ...(options?.additionalRequiredFlags ?? [])]
  const missingFlags = requiredFlags.filter((flag) => !environment[flag])

  if (missingFlags.length > 0) {
    renderWarning({
      body: ['Missing required flags in environment configuration:', {list: {items: missingFlags}}],
    })
    return false
  }

  return true
}
