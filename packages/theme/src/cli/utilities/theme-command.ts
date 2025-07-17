import {ensureThemeStore} from './theme-store.js'
import {configurationFileName} from '../constants.js'
import {Input} from '@oclif/core/interfaces'
import Command, {ArgOutput, FlagOutput} from '@shopify/cli-kit/node/base-command'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {renderWarning, renderConcurrent} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'
import type {Writable} from 'stream'

export interface FlagValues {
  [key: string]: boolean | string | string[] | number | undefined
}
interface PassThroughFlagsOptions {
  // Only pass on flags that are relevant to CLI2
  allowedFlags?: string[]
}

export default abstract class ThemeCommand extends Command {
  passThroughFlags(flags: FlagValues, {allowedFlags}: PassThroughFlagsOptions): string[] {
    const passThroughFlags: string[] = []
    for (const [label, value] of Object.entries(flags)) {
      if (!(allowedFlags ?? []).includes(label)) {
        continue
      } else if (typeof value === 'boolean') {
        if (value) passThroughFlags.push(`--${label}`)
      } else if (Array.isArray(value)) {
        value.forEach((element) => passThroughFlags.push(`--${label}`, element))
      } else {
        passThroughFlags.push(`--${label}`, `${value}`)
      }
    }
    return passThroughFlags
  }

  environmentsFilename(): string {
    return configurationFileName
  }

  async command(
    _flags: FlagValues,
    _session: AdminSession,
    _multiEnvironment?: boolean,
    _context?: {stdout?: Writable; stderr?: Writable},
  ): Promise<void> {}

  async run<
    TFlags extends FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends FlagOutput,
    TArgs extends ArgOutput,
  >(_opts?: Input<TFlags, TGlobalFlags, TArgs>): Promise<void> {
    // Parse command flags using the current command class definitions
    const klass = this.constructor as unknown as Input<TFlags, TGlobalFlags, TArgs> & {
      multiEnvironmentsFlags: string[]
    }
    const requiredFlags = klass.multiEnvironmentsFlags
    const {flags} = await this.parse(klass)

    const environments = (Array.isArray(flags.environment) ? flags.environment : [flags.environment]).filter(Boolean)

    // Single environment or no environment
    if (environments.length <= 1) {
      const session = await this.createSession(flags)
      await this.command(flags, session)
      return
    }

    // Multiple environments
    const sessions: {[storeFqdn: string]: AdminSession} = {}

    // Authenticate on all environments sequentially to avoid race conditions,
    // with authentication happening in parallel.
    for (const environmentName of environments) {
      // eslint-disable-next-line no-await-in-loop
      const environmentConfig = await loadEnvironment(environmentName, 'shopify.theme.toml', {
        from: flags.path,
        silent: true,
      })
      // eslint-disable-next-line no-await-in-loop
      sessions[environmentName] = await this.createSession(environmentConfig as FlagValues)
    }

    // Use renderConcurrent for multi-environment execution
    const abortController = new AbortController()

    await renderConcurrent({
      processes: environments.map((environment: string) => ({
        prefix: environment,
        action: async (stdout: Writable, stderr: Writable, _signal) => {
          const environmentConfig = await loadEnvironment(environment, 'shopify.theme.toml', {
            from: flags.path,
            silent: true,
          })
          const environmentFlags = {
            ...flags,
            ...environmentConfig,
            environment: [environment],
          }

          if (!this.validConfig(environmentConfig as FlagValues, requiredFlags, environment)) return

          const session = sessions[environment]

          if (!session) {
            throw new AbortError(`No session found for environment ${environment}`)
          }

          await this.command(environmentFlags, session, false, {stdout, stderr})
        },
      })),
      abortSignal: abortController.signal,
      showTimestamps: true,
    })
  }

  private async createSession(flags: FlagValues) {
    const store = flags.store as string
    const password = flags.password as string
    return ensureAuthenticatedThemes(ensureThemeStore({store}), password)
  }

  private validConfig(environmentConfig: FlagValues, requiredFlags: string[], environmentName: string): boolean {
    if (!environmentConfig) {
      renderWarning({body: 'Environment configuration is empty.'})
      return false
    }
    const required = [...requiredFlags]
    const missingFlags = required.filter((flag) => !environmentConfig[flag])

    if (missingFlags.length > 0) {
      renderWarning({
        body: [
          `Missing required flags in environment configuration${environmentName ? ` for ${environmentName}` : ''}:`,
          {list: {items: missingFlags}},
        ],
      })
      return false
    }

    return true
  }
}
