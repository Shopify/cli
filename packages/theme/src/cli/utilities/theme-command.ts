import {ensureThemeStore} from './theme-store.js'
import {configurationFileName} from '../constants.js'
import metadata from '../metadata.js'
import {useThemeStoreContext} from '../services/local-storage.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {Input} from '@oclif/core/interfaces'
import Command, {ArgOutput, FlagOutput} from '@shopify/cli-kit/node/base-command'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {
  renderWarning,
  renderConcurrent,
  renderConfirmationPrompt,
  RenderConfirmationPromptOptions,
  renderError,
} from '@shopify/cli-kit/node/ui'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {recordEvent} from '@shopify/cli-kit/node/themes/analytics'
import type {Writable} from 'stream'

export interface FlagValues {
  [key: string]: boolean | string | string[] | number | undefined
}
interface PassThroughFlagsOptions {
  // Only pass on flags that are relevant to CLI2
  allowedFlags?: string[]
}
type EnvironmentName = string
/**
 * Flags required to run a command in multiple environments
 *
 * If the command does not support multiple environments, set to null
 *
 * Otherwise, each element can be:
 * - string: A required flag
 * - string[]: Multiple flags where at least one is required,
 *             ordered by precedence
 *
 *  @example
 * // store, password, and one of: live, development, or theme
 * ['store', 'password', ['live', 'development', 'theme']]
 */
export type RequiredFlags = (string | string[])[] | null

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
      multiEnvironmentsFlags: RequiredFlags
      flags: FlagOutput
    }
    const requiredFlags = klass.multiEnvironmentsFlags
    const {flags} = await this.parse(klass)

    const environments = (Array.isArray(flags.environment) ? flags.environment : [flags.environment]).filter(Boolean)

    // Single environment or no environment
    if (environments.length <= 1) {
      const session = await this.createSession(flags)
      const commandName = this.constructor.name.toLowerCase()

      recordEvent(`theme-command:${commandName}:single-env:authenticated`)

      await this.command(flags, session)
      return
    }

    // Multiple environments
    if (requiredFlags === null) {
      renderWarning({body: 'This command does not support multiple environments.'})
      return
    }

    const environmentsMap = await this.loadEnvironments(environments, flags)
    const validationResults = await this.validateEnvironments(environmentsMap, requiredFlags)

    const commandAllowsForceFlag = 'force' in klass.flags

    if (commandAllowsForceFlag && !flags.force) {
      const confirmed = await this.showConfirmation(this.constructor.name, requiredFlags, validationResults)
      if (!confirmed) return
    }

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
  private async validateEnvironments(
    environmentMap: Map<EnvironmentName, FlagValues>,
    requiredFlags: Exclude<RequiredFlags, null>,
  ) {
    const valid: {environment: EnvironmentName; flags: FlagValues}[] = []
    const invalid: {environment: EnvironmentName; reason: string}[] = []

    for (const [environmentName, environmentFlags] of environmentMap) {
      const validationResult = this.validConfig(environmentFlags, requiredFlags, environmentName)
      if (validationResult !== true) {
        const missingFlagsText = validationResult.join(', ')
        invalid.push({environment: environmentName, reason: `Missing flags: ${missingFlagsText}`})
        continue
      }

      valid.push({environment: environmentName, flags: environmentFlags})
    }

    return {valid, invalid}
  }

  /**
   * Show a confirmation prompt
   * @param commandName - The name of the command being run
   * @param requiredFlags - The flags required to run the command
   * @param validationResults -  The environments split into valid and invalid
   * @returns Whether the user confirmed the action
   */
  private async showConfirmation(
    commandName: string,
    requiredFlags: Exclude<RequiredFlags, null>,
    validationResults: {
      valid: {environment: string; flags: FlagValues}[]
      invalid: {environment: string; reason: string}[]
    },
  ) {
    const command = commandName.toLowerCase()
    const message = [`Run ${command} in the following environments?`]

    const options: RenderConfirmationPromptOptions = {
      message,
      confirmationMessage: 'Yes, proceed',
      cancellationMessage: 'Cancel',
    }

    const environmentDetails = [
      ...validationResults.valid.map(({environment, flags}) => {
        const flagDetails = requiredFlags
          .map((flag) => {
            const usedFlag = Array.isArray(flag) ? flag.find((flag) => flags[flag]) : flag
            return usedFlag && [usedFlag.includes('password') ? usedFlag : `${usedFlag}: ${flags[usedFlag]}`]
          })
          .join(', ')

        return [environment, {subdued: flagDetails || 'No flags required'}]
      }),
      ...validationResults.invalid.map(({environment, reason}) => [environment, {error: `Skipping | ${reason}`}]),
    ]

    options.infoTable = {Environment: environmentDetails}

    if (validationResults.invalid.length > 0) {
      options.confirmationMessage = 'Proceed anyway (will skip invalid environments)'
    }

    return renderConfirmationPrompt(options)
  }

  /**
   * Run the command in each valid environment concurrently
   * @param validEnvironments - The valid environments to run the command in
   */
  private async runConcurrent(validEnvironments: {environment: EnvironmentName; flags: FlagValues}[]) {
    const abortController = new AbortController()

    await renderConcurrent({
      processes: validEnvironments.map(({environment, flags}) => ({
        prefix: environment,
        action: async (stdout: Writable, stderr: Writable, _signal) => {
          try {
            const store = flags.store as string
            await useThemeStoreContext(store, async () => {
              const session = await this.createSession(flags)

              const commandName = this.constructor.name.toLowerCase()
              recordEvent(`theme-command:${commandName}:multi-env:authenticated`)

              await this.command(flags, session, true, {stdout, stderr})
            })

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
   * Create an unauthenticated session object from store and password
   * @param flags - The environment flags containing store and password
   * @returns The unauthenticated session object
   */
  private async createSession(flags: FlagValues) {
    const store = flags.store as string
    const password = flags.password as string
    const session = await ensureAuthenticatedThemes(ensureThemeStore({store}), password)
    await this.logStoreMetadata(session)

    return session
  }

  /**
   * Ensure that all required flags are present
   * @param environmentFlags - The environment flags
   * @param requiredFlags - The flags required by the command
   * @param environmentName - The name of the environment
   * @returns The missing flags or true if the environment has all required flags
   */
  private validConfig(
    environmentFlags: FlagValues,
    requiredFlags: Exclude<RequiredFlags, null>,
    environmentName: string,
  ): string[] | true {
    const missingFlags = requiredFlags
      .filter((flag) => (Array.isArray(flag) ? !flag.some((flag) => environmentFlags[flag]) : !environmentFlags[flag]))
      .map((flag) => (Array.isArray(flag) ? flag.join(' or ') : flag))

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

  private async logStoreMetadata(session: AdminSession): Promise<void> {
    await metadata.addPublicMetadata(() => ({
      store_fqdn_hash: hashString(session.storeFqdn),
    }))

    await metadata.addSensitiveMetadata(() => ({
      store_fqdn: session.storeFqdn,
    }))
  }
}
