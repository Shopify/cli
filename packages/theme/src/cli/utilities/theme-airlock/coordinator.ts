import {bootstrapThemeAirlock, interactiveBootstrapUI} from './bootstrap.js'
import {loadThemeProjectTrust} from './config.js'
import {resolveBatchAirlockTargets, resolveSingleAirlockTarget} from './resolver.js'
import {ThemeAirlockError} from './types.js'
import {useThemeStoreContext} from '../../services/local-storage.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {cwd} from '@shopify/cli-kit/node/path'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

import type {AirlockTarget} from './types.js'
import type {AdminSession} from '@shopify/cli-kit/node/session'

export type AirlockFlagValues = Record<string, boolean | string | string[] | number | undefined>

interface ThemeAirlockCoordinatorOptions {
  argv: string[]
  env: NodeJS.ProcessEnv
  authenticate: (flags: AirlockFlagValues, suppliedSession?: AdminSession) => Promise<AdminSession>
  rememberedStore: () => string | undefined
  supportsPrompting: () => boolean
  renderPreflight: (targets: AirlockTarget[]) => void
  storedSessionsFor: (flagsList: AirlockFlagValues[]) => Map<string, AdminSession>
  storedSessionFromCache: (flags: AirlockFlagValues, sessions: Map<string, AdminSession>) => AdminSession | undefined
  missingRequiredFlags: (
    flags: AirlockFlagValues,
    requiredFlags: (string | string[])[],
    suppliedSession?: AdminSession,
  ) => string[]
}

interface RunSingleOptions<T> {
  flags: AirlockFlagValues
  requiresAuth: boolean
  execute: (flags: AirlockFlagValues, target: AirlockTarget, session?: AdminSession) => Promise<T>
}

interface AirlockBatchEnvironment {
  environment: string
  flags: AirlockFlagValues
  validationFlags: AirlockFlagValues
}

export interface AirlockBatchExecutionEnvironment {
  environment: string
  flags: AirlockFlagValues
  requiresAuth: boolean
  session?: AdminSession
}

interface RunBatchOptions<T> {
  environments: AirlockBatchEnvironment[]
  requiredFlags: (string | string[])[]
  requiresAuth: boolean
  confirm?: (environments: AirlockBatchExecutionEnvironment[]) => Promise<boolean>
  execute: (environments: AirlockBatchExecutionEnvironment[], targets: AirlockTarget[]) => Promise<T>
}

export class ThemeAirlockCoordinator {
  constructor(private readonly options: ThemeAirlockCoordinatorOptions) {}

  async runSingle<T>({flags, requiresAuth, execute}: RunSingleOptions<T>): Promise<T> {
    const themePath = typeof flags.path === 'string' ? flags.path : cwd()
    if (!fileExistsSync(themePath)) {
      throw new AbortError(`Path does not exist: ${themePath}`)
    }

    const trust = await loadThemeProjectTrust(themePath)
    const resolution = resolveSingleAirlockTarget({
      trust,
      flags,
      argv: this.options.argv,
      env: this.options.env,
    })

    let approvedFlags: AirlockFlagValues
    let target: AirlockTarget
    let session: AdminSession | undefined

    if ('bootstrap' in resolution) {
      if (!this.options.supportsPrompting()) {
        throw new ThemeAirlockError(
          'This theme project is not configured. Run `theme airlock add` before running this command without a terminal.',
          'unconfigured-project',
        )
      }

      const rememberedStore = resolution.allowRememberedCandidate ? this.options.rememberedStore() : undefined
      const bootstrapUI = interactiveBootstrapUI()
      const bootstrap = await bootstrapThemeAirlock({
        themePath,
        candidate: resolution.candidate,
        proposedEnvironment: resolution.proposedEnvironment,
        rememberedStore,
        confirmStore: bootstrapUI.confirmStore,
        promptStore: bootstrapUI.promptStore,
        promptEnvironment: bootstrapUI.promptEnvironment,
        authenticate: async (store) => this.options.authenticate({...flags, store}),
      })
      approvedFlags = {...flags, store: bootstrap.target.store}
      target = bootstrap.target
      session = requiresAuth ? bootstrap.session : undefined
    } else {
      approvedFlags = {...flags, store: resolution.store}
      target = resolution
      session = requiresAuth ? await this.options.authenticate(approvedFlags) : undefined
    }

    this.options.renderPreflight([target])
    return useThemeStoreContext(target.store, () => execute(approvedFlags, target, session))
  }

  async runBatch<T>({
    environments,
    requiredFlags,
    requiresAuth,
    confirm,
    execute,
  }: RunBatchOptions<T>): Promise<T | undefined> {
    const validatedEnvironments: {
      environment: AirlockBatchEnvironment
      target: AirlockTarget
    }[] = []

    for (const environment of environments) {
      const themePath = typeof environment.flags.path === 'string' ? environment.flags.path : cwd()
      if (!fileExistsSync(themePath)) {
        throw new ThemeAirlockError(
          `Invalid batch environment "${environment.environment}": path does not exist: ${themePath}.`,
          'invalid-batch',
        )
      }

      // Trust is loaded from each environment's effective path so nested projects retain nearest-config semantics.
      // eslint-disable-next-line no-await-in-loop
      const trust = await loadThemeProjectTrust(themePath)
      const [target] = resolveBatchAirlockTargets({
        trust,
        environments: [{name: environment.environment, store: environment.flags.store as string}],
      })
      if (!target) {
        throw new ThemeAirlockError(
          `Invalid batch environment "${environment.environment}": no trust target resolved.`,
          'invalid-batch',
        )
      }

      validatedEnvironments.push({environment, target})
    }

    // Do not project cached sessions until all effective paths and trust targets have been validated.
    const storedSessions = requiresAuth
      ? this.options.storedSessionsFor(validatedEnvironments.map(({environment}) => environment.validationFlags))
      : new Map<string, AdminSession>()
    const executionEnvironments: AirlockBatchExecutionEnvironment[] = []
    const targets: AirlockTarget[] = []

    for (const {environment, target} of validatedEnvironments) {
      const storedSession = this.options.storedSessionFromCache(environment.validationFlags, storedSessions)
      const missingFlags = this.options.missingRequiredFlags(environment.validationFlags, requiredFlags, storedSession)
      if (missingFlags.length > 0) {
        throw new ThemeAirlockError(
          `Invalid batch environment "${environment.environment}": missing required flags: ${missingFlags.join(', ')}.`,
          'invalid-batch',
        )
      }

      executionEnvironments.push({
        environment: environment.environment,
        flags: {...environment.flags, store: target.store},
        requiresAuth,
        session: storedSession,
      })
      targets.push(target)
    }

    if (confirm && !(await confirm(executionEnvironments))) return undefined

    const authenticatedSessionsByStore = new Map<string, Map<string, AdminSession>>()
    for (const environment of executionEnvironments) {
      if (!environment.requiresAuth) continue

      const store = normalizeStoreFqdn(environment.flags.store as string)
      const password = typeof environment.flags.password === 'string' ? environment.flags.password : undefined
      const sessionsByPassword = authenticatedSessionsByStore.get(store) ?? new Map<string, AdminSession>()
      const authenticatedSession = sessionsByPassword.get(password ?? '')
      if (authenticatedSession) {
        environment.session = authenticatedSession
        continue
      }

      // eslint-disable-next-line no-await-in-loop
      environment.session = await this.options.authenticate(environment.flags, environment.session)
      sessionsByPassword.set(password ?? '', environment.session)
      authenticatedSessionsByStore.set(store, sessionsByPassword)
    }

    this.options.renderPreflight(targets)
    return execute(executionEnvironments, targets)
  }
}
