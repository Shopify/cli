import {ensureThemeStore} from './theme-store.js'
import {configurationFileName} from '../constants.js'
import {useThemeStoreContext} from '../services/local-storage.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {Input} from '@oclif/core/interfaces'
import Command, {ArgOutput, FlagOutput, noDefaultsOptions} from '@shopify/cli-kit/node/base-command'
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
import {recordEvent, compileData} from '@shopify/cli-kit/node/analytics'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import type {Writable} from 'stream'

export interface FlagValues {
  [key: string]: boolean | string | string[] | number | undefined
}
interface PassThroughFlagsOptions {
  // Only pass on flags that are relevant to CLI2
  allowedFlags?: string[]
}
interface ValidEnvironment {
  environment: EnvironmentName
  flags: FlagValues
  requiresAuth: boolean
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
    _session?: AdminSession,
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
    const commandRequiresAuth = 'password' in klass.flags
    const environments = (Array.isArray(flags.environment) ? flags.environment : [flags.environment]).filter(Boolean)

    // Single environment or no environment
    if (environments.length <= 1) {
      const session = commandRequiresAuth ? await this.createSession(flags) : undefined
      const commandName = this.constructor.name.toLowerCase()

      recordEvent(`theme-command:${commandName}:single-env:authenticated`)

      await this.command(flags, session)
      await this.logAnalyticsData(session)
      return
    }

    // Multiple environments
    if (requiredFlags === null) {
      renderWarning({body: 'This command does not support multiple environments.'})
      return
    }

    const {flags: flagsWithoutDefaults} = await this.parse(noDefaultsOptions(klass), this.argv)
    if ('path' in flagsWithoutDefaults) {
      this.errorOnGlobalPath()
      return
    }

    const environmentsMap = await this.loadEnvironments(environments, flags, flagsWithoutDefaults)
    const validationResults = await this.validateEnvironments(environmentsMap, requiredFlags, commandRequiresAuth)

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
   * @param flags - Flags provided via the CLI or by default
   * @param flagsWithoutDefaults - Flags provided via the CLI
   * @returns The map of environments
   */
  private async loadEnvironments(
    environments: EnvironmentName[],
    flags: FlagValues,
    flagsWithoutDefaults: FlagValues,
  ): Promise<Map<EnvironmentName, FlagValues>> {
    const environmentMap = new Map<EnvironmentName, FlagValues>()

    for (const environmentName of environments) {
      // eslint-disable-next-line no-await-in-loop
      const environmentFlags = await loadEnvironment(environmentName, 'shopify.theme.toml', {
        from: flags.path as string,
        silent: true,
      })

      if (environmentFlags?.store && typeof environmentFlags.store === 'string') {
        // eslint-disable-next-line no-await-in-loop
        environmentFlags.store = await normalizeStoreFqdn(environmentFlags.store)
      }

      environmentMap.set(environmentName, {
        ...flags,
        ...environmentFlags,
        ...flagsWithoutDefaults,
        environment: [environmentName],
      })
    }

    return environmentMap
  }

  /**
   * Split environments into valid and invalid based on flags
   * @param environmentMap - The map of environments to validate
   * @param requiredFlags - The required flags to check for
   * @param requiresAuth - Whether the command requires authentication
   * @returns An object containing valid and invalid environment arrays
   */
  private async validateEnvironments(
    environmentMap: Map<EnvironmentName, FlagValues>,
    requiredFlags: Exclude<RequiredFlags, null>,
    requiresAuth: boolean,
  ) {
    const valid: ValidEnvironment[] = []
    const invalid: {environment: EnvironmentName; reason: string}[] = []

    for (const [environmentName, environmentFlags] of environmentMap) {
      const validationResult = this.validConfig(environmentFlags, requiredFlags, environmentName)
      if (validationResult !== true) {
        const missingFlagsText = validationResult.join(', ')
        invalid.push({environment: environmentName, reason: `Missing flags: ${missingFlagsText}`})
        continue
      }
      valid.push({environment: environmentName, flags: environmentFlags, requiresAuth})
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
      valid: ValidEnvironment[]
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
  private async runConcurrent(validEnvironments: ValidEnvironment[]) {
    const abortController = new AbortController()

    const stores = validEnvironments.map((env) => env.flags.store as string)
    const uniqueStores = new Set(stores)
    const runGroups =
      stores.length === uniqueStores.size ? [validEnvironments] : this.createSequentialGroups(validEnvironments)

    for (const runGroup of runGroups) {
      // eslint-disable-next-line no-await-in-loop
      await renderConcurrent({
        processes: runGroup.map(({environment, flags, requiresAuth}) => ({
          prefix: environment,
          action: async (stdout: Writable, stderr: Writable, _signal) => {
            try {
              const store = flags.store as string
              await useThemeStoreContext(store, async () => {
                const session = requiresAuth ? await this.createSession(flags) : undefined

                const commandName = this.constructor.name.toLowerCase()
                recordEvent(`theme-command:${commandName}:multi-env:authenticated`)

                await this.command(flags, session, true, {stdout, stderr})
                await this.logAnalyticsData(session)
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
  }

  /**
   * Create groups of environments with unique flags.store values to run sequentially
   * to prevent conflicts between environments acting on the same store
   * @param environments - The environments to group
   * @returns The environment groups
   */
  private createSequentialGroups(environments: ValidEnvironment[]) {
    const groups: ValidEnvironment[][] = []

    environments.forEach((environment) => {
      const groupWithoutStore = groups.find((arr) => !arr.some((env) => env.flags.store === environment.flags.store))
      groupWithoutStore ? groupWithoutStore.push(environment) : groups.push([environment])
    })

    return groups
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

  /**
   * Error if the --path flag is provided via CLI when running a multi environment command
   * Commands that act on local files require each environment to specify its own path in the shopify.theme.toml
   */
  private errorOnGlobalPath() {
    const tomlPath = joinPath(cwd(), 'shopify.theme.toml')
    const tomlInCwd = fileExistsSync(tomlPath)

    renderError({
      body: [
        "Can't use `--path` flag with multiple environments.",
        ...(tomlInCwd
          ? ["Configure each environment's theme path in your shopify.theme.toml file instead."]
          : [
              'Run this command from the directory containing shopify.theme.toml.',
              'No shopify.theme.toml found in current directory.',
            ]),
      ],
    })
  }

  private async logAnalyticsData(session?: AdminSession): Promise<void> {
    if (!session) return

    const data = compileData()

    await addPublicMetadata(() => ({
      store_fqdn_hash: hashString(session.storeFqdn),

      cmd_theme_timings: JSON.stringify(data.timings),
      cmd_theme_errors: JSON.stringify(data.errors),
      cmd_theme_retries: JSON.stringify(data.retries),
      cmd_theme_events: JSON.stringify(data.events),
    }))
    await addSensitiveMetadata(() => ({
      store_fqdn: session.storeFqdn,
    }))
  }
}
