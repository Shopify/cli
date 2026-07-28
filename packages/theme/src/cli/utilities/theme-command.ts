import {ensureThemeStore} from './theme-store.js'
import {configurationFileName} from '../constants.js'
import {useThemeStoreContext} from '../services/local-storage.js'

import {hashString} from '@shopify/cli-kit/node/crypto'
import {Input} from '@oclif/core/interfaces'
import {authAliasFlag} from '@shopify/cli-kit/node/cli'
import Command, {ArgOutput, FlagOutput, noDefaultsOptions} from '@shopify/cli-kit/node/base-command'
import {AdminSession, ensureAuthenticatedThemes, setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {
  getCurrentStoredStoreAppSession,
  listCurrentStoredStoreAppSessions,
  type StoredStoreAppSession,
} from '@shopify/cli-kit/node/store-auth-session'
import {throwIfStoredStoreAuthIsInvalid} from '@shopify/cli-kit/node/store-auth-recovery'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {
  renderWarning,
  renderConcurrent,
  renderConfirmationPrompt,
  RenderConfirmationPromptOptions,
  renderError,
  type TokenItem,
} from '@shopify/cli-kit/node/ui'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {AbortError, FatalError} from '@shopify/cli-kit/node/error'
import {recordEvent, compileData} from '@shopify/cli-kit/node/analytics'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

import type {Writable} from 'stream'

type FlagValues = Record<string, boolean | string | string[] | number | undefined>

/**
 * An Admin session together with the provenance the recovery flow needs.
 *
 * Commands only ever receive the plain `adminSession`; `storedStoreAppSession` stays internal to
 * this class so that a failure can be traced back to the `shopify store auth` session that produced
 * it. Provenance is never inferred from the token string, because a stored preview-store token and
 * an explicitly supplied custom-app token are both `shpat_…`.
 */
interface ThemeSessionContext {
  adminSession: AdminSession
  /** Set only when `adminSession` came from a locally stored `shopify store auth` session. */
  storedStoreAppSession?: StoredStoreAppSession
}

interface ValidEnvironment {
  environment: EnvironmentName
  flags: FlagValues
  requiresAuth: boolean
  storeAuthSession?: ThemeSessionContext
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

// Theme commands classify HTTP 401 only. A 401 is what a claimed preview store's stale Admin token
// actually returns, and theme commands accept `--theme <id>`, so classifying 404 as well would
// misreport a genuinely missing theme as a claimed store. `store` commands keep classifying both.
const THEME_INVALID_STORE_AUTH_STATUSES = [401]

// A stored `store auth` session can stop being accepted without any local signal, most often
// because its preview store was claimed through the browser. Only a run actually backed by a stored
// session is eligible for the recovery message: an explicitly supplied `--password` token can look
// identical (`shpat_…`) and must never be blamed on `shopify store auth`.
//
// Preview sessions are the only kind theme commands classify. `store` commands reach a 401 *after*
// `loadStoredStoreSession` has already refreshed an expired token, so there the status is a
// definitive verdict on the session. Theme commands use the stored access token as-is, with no
// expiry check and no refresh, so an ordinary expired-but-refreshable standard session 401s here
// for a reason re-authenticating wouldn't fix - and `throwIfStoredStoreAuthIsInvalid` would clear
// the record, destroying a refresh token that would have worked. A standard session's 401 therefore
// propagates raw, exactly as it did before this recovery flow existed. Preview sessions carry no
// refresh token to lose, so nothing is protected by staying quiet about them.
function throwIfThemeStoreAuthIsInvalid(error: unknown, sessionContext: ThemeSessionContext | undefined): void {
  const storedSession = sessionContext?.storedStoreAppSession
  if (storedSession?.kind !== 'preview') return

  throwIfStoredStoreAuthIsInvalid(error, storedSession, {invalidStatuses: THEME_INVALID_STORE_AUTH_STATUSES})
}

// `renderError` takes a single `body` and renders a token array as one space-joined paragraph, so
// appending the `tryMessage` tokens to the message would run the two together mid-sentence. The
// blank line that `renderFatalError` gets for free (it renders message and `tryMessage` as separate
// blocks) is carried here on the `tryMessage`'s leading token instead, so the two stay distinct
// paragraphs.
function bodyWithSeparateTryMessage(message: string, tryMessage: TokenItem | null | undefined): TokenItem {
  const tryMessageTokens = tryMessage ? [tryMessage].flat() : []
  const [firstToken, ...remainingTokens] = tryMessageTokens
  if (firstToken === undefined) return message

  const paragraphBreak = '\n\n'

  // Only a string token can carry the break without a stray leading space, because a token
  // following a non-`char` token is always rendered with a space in front of it.
  return typeof firstToken === 'string'
    ? [message, `${paragraphBreak}${firstToken}`, ...remainingTokens]
    : [message, paragraphBreak, firstToken, ...remainingTokens]
}

// `renderError` only prints what it is given, so prefixing the environment onto `error.message` (as
// this used to do) silently dropped a `FatalError`'s `tryMessage`, `nextSteps` and custom sections.
// The environment is prefixed structurally as a headline instead, and the remaining parts are
// forwarded, so per-environment failures keep the guidance that makes them actionable.
function renderEnvironmentFailure(environment: EnvironmentName, error: Error): void {
  const fatalError = error instanceof FatalError ? error : undefined

  renderError({
    headline: `Environment ${environment} failed:`,
    body: bodyWithSeparateTryMessage(error.message, fatalError?.tryMessage),
    ...(fatalError?.nextSteps?.length ? {nextSteps: fatalError.nextSteps} : {}),
    ...(fatalError?.customSections?.length ? {customSections: fatalError.customSections} : {}),
  })
}

export default abstract class ThemeCommand extends Command {
  static baseFlags = authAliasFlag

  environmentsFilename(): string {
    return configurationFileName
  }

  async command(
    _flags: FlagValues,
    _session?: AdminSession,
    _multiEnvironment = false,
    _args?: ArgOutput,
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
      args: ArgOutput
    }
    const requiredFlags = klass.multiEnvironmentsFlags
    const {args, flags} = await this.parse(klass)
    const commandRequiresAuth = 'password' in klass.flags

    const environments = (Array.isArray(flags.environment) ? flags.environment : [flags.environment]).filter(Boolean)

    // Check if store flag is required by the command
    const storeIsRequired =
      requiredFlags !== null &&
      requiredFlags.some((flag) => (Array.isArray(flag) ? flag.includes('store') : flag === 'store'))

    // Single environment or no environment
    if (environments.length <= 1) {
      if (environments[0] && !flags.store && storeIsRequired) {
        throw new AbortError(`Please provide a valid environment.`)
      }

      const sessionContext = commandRequiresAuth ? await this.createSession(flags) : undefined
      const session = sessionContext?.adminSession
      const commandName = this.constructor.name.toLowerCase()

      recordEvent(`theme-command:${commandName}:single-env:authenticated`)

      if (flags.path && !fileExistsSync(flags.path)) {
        throw new AbortError(`Path does not exist: ${flags.path}`)
      }

      try {
        await this.command(flags, session, false, args)
      } catch (error) {
        throwIfThemeStoreAuthIsInvalid(error, sessionContext)
        throw error
      } finally {
        await this.logAnalyticsData(session)
      }
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

  protected storeAuthScopes(): string[] {
    return []
  }

  /**
   * Create a map of environments from the shopify.theme.toml file
   * @param environments - Names of environments to load
   * @param flags - Flags provided via the CLI or by default
   * @param flagsWithoutDefaults - Flags provided via the CLI
   * @returns The map of environments
   */
  private async loadEnvironments(environments: EnvironmentName[], flags: FlagValues, flagsWithoutDefaults: FlagValues) {
    const environmentMap = new Map<EnvironmentName, {flags: FlagValues; validationFlags: FlagValues}>()

    for (const environmentName of environments) {
      // eslint-disable-next-line no-await-in-loop
      const environmentFlags = await loadEnvironment(environmentName, 'shopify.theme.toml', {
        from: flags.path as string,
        silent: true,
      })

      if (environmentFlags?.store && typeof environmentFlags.store === 'string') {
        environmentFlags.store = normalizeStoreFqdn(environmentFlags.store)
      }

      if (environmentFlags?.path && typeof environmentFlags.path === 'string') {
        environmentFlags.path = resolvePath(environmentFlags.path)
      }

      environmentMap.set(environmentName, {
        flags: {
          ...flags,
          ...environmentFlags,
          ...flagsWithoutDefaults,
          environment: [environmentName],
        },
        validationFlags: {...environmentFlags, ...flagsWithoutDefaults} as FlagValues,
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
    environmentMap: Map<EnvironmentName, {flags: FlagValues; validationFlags: FlagValues}>,
    requiredFlags: Exclude<RequiredFlags, null>,
    requiresAuth: boolean,
  ) {
    const valid: ValidEnvironment[] = []
    const invalid: {environment: EnvironmentName; reason: string}[] = []

    const storeAuthSessionsByStore = requiresAuth
      ? this.storeAuthSessionsForTheme(Array.from(environmentMap.values()).map(({validationFlags}) => validationFlags))
      : new Map<string, ThemeSessionContext>()

    const entriesWithStoreAuthSessions = Array.from(environmentMap.entries()).map(
      ([environmentName, {flags, validationFlags}]) => ({
        environmentName,
        flags,
        validationFlags,
        storeAuthSession: this.storeAuthSessionFromCache(validationFlags, storeAuthSessionsByStore),
      }),
    )

    for (const {environmentName, flags, validationFlags, storeAuthSession} of entriesWithStoreAuthSessions) {
      const validationResult = this.validConfig(validationFlags, requiredFlags, environmentName, storeAuthSession)
      if (validationResult !== true) {
        const missingFlagsText = validationResult.join(', ')
        invalid.push({environment: environmentName, reason: `Missing flags: ${missingFlagsText}`})
        continue
      }
      valid.push({environment: environmentName, flags, requiresAuth, storeAuthSession})
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
            if (usedFlag === 'password') return `password`
            if (usedFlag === 'path' && typeof flags.path === 'string') {
              const splits = flags.path.split(/[/\\]/)
              if (splits.length === 1) return `path: ${flags.path}`
              const first = splits[0] === '' ? `/${splits[1]}` : splits[0]
              const last = splits.at(-1)
              return `path: ${first}/.../${last}`
            }
            return usedFlag && `${usedFlag}: ${flags[usedFlag]}`
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
        processes: runGroup.map(({environment, flags, requiresAuth, storeAuthSession}) => ({
          prefix: environment,
          action: async (stdout: Writable, stderr: Writable, _signal) => {
            try {
              const store = flags.store as string
              await useThemeStoreContext(store, async () => {
                const sessionContext = requiresAuth ? await this.createSession(flags, storeAuthSession) : undefined
                const session = sessionContext?.adminSession

                const commandName = this.constructor.name.toLowerCase()
                recordEvent(`theme-command:${commandName}:multi-env:authenticated`)

                try {
                  await this.command(flags, session, true, {}, {stdout, stderr})
                } catch (error) {
                  throwIfThemeStoreAuthIsInvalid(error, sessionContext)
                  throw error
                } finally {
                  await this.logAnalyticsData(session)
                }
              })

              // eslint-disable-next-line no-catch-all/no-catch-all
            } catch (error) {
              if (error instanceof Error) {
                renderEnvironmentFailure(environment, error)
              }
            }
          },
        })),
        abortSignal: abortController.signal,
        showTimestamps: true,
        renderOptions: {stdout: process.stderr},
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
   * @param storeAuthSession - A store-auth session already resolved for this environment
   * @returns The unauthenticated session object and where it came from
   */
  private async createSession(flags: FlagValues, storeAuthSession?: ThemeSessionContext): Promise<ThemeSessionContext> {
    const store = ensureThemeStore({store: flags.store as string | undefined})
    const password = flags.password as string | undefined

    if (password) {
      return {adminSession: await ensureAuthenticatedThemes(store, password)}
    }

    const storeAuthContext = storeAuthSession ?? (await this.storeAuthSessionForTheme({store}))
    if (storeAuthContext) return storeAuthContext

    return {adminSession: await ensureAuthenticatedThemes(store, password)}
  }

  private async storeAuthSessionForTheme(flags: FlagValues): Promise<ThemeSessionContext | undefined> {
    const store = typeof flags.store === 'string' ? flags.store : undefined
    const password = flags.password
    if (!store || password) return undefined

    const storeFqdn = normalizeStoreFqdn(store)
    const storedSession = getCurrentStoredStoreAppSession(storeFqdn)
    if (!storedSession) return undefined

    return this.themeSessionContextFromStoreAuthSession(storedSession, storeFqdn)
  }

  private storeAuthSessionsForTheme(flagsList: FlagValues[]): Map<string, ThemeSessionContext> {
    const stores = new Set(
      flagsList
        .filter(({store, password}) => typeof store === 'string' && !password)
        .map(({store}) => normalizeStoreFqdn(store as string)),
    )
    if (stores.size === 0) return new Map()

    return new Map(
      listCurrentStoredStoreAppSessions()
        .map((storedSession) => {
          const storeFqdn = normalizeStoreFqdn(storedSession.store)
          if (!stores.has(storeFqdn)) return undefined

          const sessionContext = this.themeSessionContextFromStoreAuthSession(storedSession, storeFqdn)
          return sessionContext ? ([storeFqdn, sessionContext] as const) : undefined
        })
        .filter((entry): entry is readonly [string, ThemeSessionContext] => entry !== undefined),
    )
  }

  private storeAuthSessionFromCache(
    flags: FlagValues,
    storeAuthSessionsByStore: Map<string, ThemeSessionContext>,
  ): ThemeSessionContext | undefined {
    const store = typeof flags.store === 'string' ? flags.store : undefined
    const password = flags.password
    if (!store || password) return undefined

    return storeAuthSessionsByStore.get(normalizeStoreFqdn(store))
  }

  private themeSessionContextFromStoreAuthSession(
    storedSession: StoredStoreAppSession,
    storeFqdn: string,
  ): ThemeSessionContext | undefined {
    if (!this.hasRequiredStoreAuthScopes(storedSession.scopes)) {
      return undefined
    }

    setLastSeenUserId(storedSession.userId)

    return {
      adminSession: {
        token: storedSession.accessToken,
        storeFqdn,
      },
      storedStoreAppSession: storedSession,
    }
  }

  private expandImpliedStoreAuthScopes(scopes: string[]): Set<string> {
    const expandedScopes = new Set(scopes)

    for (const scope of scopes) {
      const matches = scope.match(/^(unauthenticated_)?write_(.*)$/)
      if (matches) {
        expandedScopes.add(`${matches[1] ?? ''}read_${matches[2]}`)
      }
    }

    return expandedScopes
  }

  private hasRequiredStoreAuthScopes(scopes: string[]): boolean {
    if (scopes.length === 0) return true

    const expandedScopes = this.expandImpliedStoreAuthScopes(scopes)
    return this.storeAuthScopes().every((scope) => expandedScopes.has(scope))
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
    storeAuthSession?: ThemeSessionContext,
  ): string[] | true {
    const missingFlags = requiredFlags
      .filter((flag) =>
        Array.isArray(flag)
          ? !flag.some((flag) => this.hasRequiredFlag(environmentFlags, flag, storeAuthSession))
          : !this.hasRequiredFlag(environmentFlags, flag, storeAuthSession),
      )
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

  private hasRequiredFlag(environmentFlags: FlagValues, flag: string, storeAuthSession?: ThemeSessionContext): boolean {
    if (flag === 'password' && storeAuthSession) return true
    return Boolean(environmentFlags[flag])
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
      store_domain: session.storeFqdn,

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
