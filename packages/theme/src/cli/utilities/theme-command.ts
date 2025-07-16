import {ensureThemeStore} from './theme-store.js'
import {configurationFileName} from '../constants.js'
import {Input} from '@oclif/core/interfaces'
import Command, {ArgOutput, FlagOutput} from '@shopify/cli-kit/node/base-command'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {renderWarning, renderConcurrent, renderError} from '@shopify/cli-kit/node/ui'
import {AbortController} from '@shopify/cli-kit/node/abort'
import type {Writable} from 'stream'

export interface FlagValues {
  [key: string]: boolean | string | string[] | number | undefined
}
interface PassThroughFlagsOptions {
  // Only pass on flags that are relevant to CLI2
  allowedFlags?: string[]
}
type EnvironmentName = string

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
    _multiEnvironment = false,
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
    const environmentsMap = await this.loadEnvironments(environments, flags)
    const validationResults = await this.validateEnvironments(environmentsMap, requiredFlags)

    await this.runConcurrent(validationResults.valid)
  }

  /**
   * Create a map of environments from the shopify.theme.toml file
   * @param environments - Names of environments to load
   * @param flags - Flags provided via the CLI
   * @returns The map of environments
   */
  private async loadEnvironments(
    environments: EnvironmentName[],
    flags: FlagValues,
  ): Promise<Map<EnvironmentName, FlagValues>> {
    const environmentMap = new Map<EnvironmentName, FlagValues>()

    for (const environmentName of environments) {
      // eslint-disable-next-line no-await-in-loop
      const environmentFlags = await loadEnvironment(environmentName, 'shopify.theme.toml', {
        from: flags.path as string,
        silent: true,
      })

      environmentMap.set(environmentName, {
        ...environmentFlags,
        ...flags,
        environment: [environmentName],
      })
    }

    return environmentMap
  }

  /**
   * Split environments into valid and invalid based on flags
   * @param environmentMap - The map of environments to validate
   * @param requiredFlags - The required flags to check for
   * @returns An object containing valid and invalid environment arrays
   */
  private async validateEnvironments(environmentMap: Map<EnvironmentName, FlagValues>, requiredFlags: string[]) {
    const valid: {environment: EnvironmentName; flags: FlagValues; session: AdminSession}[] = []
    const invalid: {environment: EnvironmentName; reason: string}[] = []

    for (const [environmentName, environmentFlags] of environmentMap) {
      // eslint-disable-next-line no-await-in-loop
      const session = await this.createSession(environmentFlags)

      const validationResult = this.validConfig(environmentFlags, requiredFlags, environmentName)
      if (validationResult !== true) {
        const missingFlagsText = validationResult.join(', ')
        invalid.push({environment: environmentName, reason: `Missing flags: ${missingFlagsText}`})
        continue
      }

      valid.push({environment: environmentName, flags: environmentFlags, session})
    }

    return {valid, invalid}
  }

  /**
   * Run the command in each valid environment concurrently
   * @param validEnvironments - The valid environments to run the command in
   */
  private async runConcurrent(
    validEnvironments: {environment: EnvironmentName; flags: FlagValues; session: AdminSession}[],
  ) {
    const abortController = new AbortController()

    await renderConcurrent({
      processes: validEnvironments.map(({environment, flags, session}) => ({
        prefix: environment,
        action: async (stdout: Writable, stderr: Writable, _signal) => {
          try {
            await this.command(flags, session, true, {stdout, stderr})

            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (error) {
            if (error instanceof Error) {
              error.message = `Environment ${environment} failed: \n\n${error.message}`
              renderError({body: [error.message]})
            }
          }
        },
      })),
      abortSignal: abortController.signal,
      showTimestamps: true,
    })
  }

  /**
   * Create an authenticated session object from the flags
   * @param flags - The environment flags containing store and password
   * @returns The unauthenticated session object
   */
  private async createSession(flags: FlagValues) {
    const store = flags.store as string
    const password = flags.password as string
    return ensureAuthenticatedThemes(ensureThemeStore({store}), password)
  }

  /**
   * Ensure that all required flags are present
   * @param environmentFlags - The environment flags
   * @param requiredFlags - The flags required by the command
   * @param environmentName - The name of the environment
   * @returns The missing flags or true if the environment has all required flags
   */
  private validConfig(environmentFlags: FlagValues, requiredFlags: string[], environmentName: string): string[] | true {
    const missingFlags = requiredFlags.filter((flag) => !environmentFlags[flag])

    if (missingFlags.length > 0) {
      renderWarning({
        body: [
          `Missing required flags in environment configuration${environmentName ? ` for ${environmentName}` : ''}:`,
          {list: {items: missingFlags}},
        ],
      })
      return missingFlags
    }

    return true
  }
}
