import {ThemeAirlockError} from './types.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

import type {AirlockTarget, StoreSelectionSource, ThemeProjectTrust, TrustedThemeEnvironment} from './types.js'

export type FlagValues = Record<string, boolean | string | string[] | number | undefined>

interface SuppliedValue {
  supplied: boolean
  value?: string
  occurrences: number
}

interface RawSelections {
  cliStore: SuppliedValue
  cliEnvironment: SuppliedValue
  environmentStore: SuppliedValue
  environmentName: SuppliedValue
}

interface NormalizedTrust {
  environmentsByName: Map<string, TrustedThemeEnvironment>
  environmentsByStore: Map<string, TrustedThemeEnvironment>
}

function argvValue(argv: string[], longName: string, shortName: string): SuppliedValue {
  let selection: SuppliedValue = {supplied: false, occurrences: 0}

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === undefined || argument === '--') break

    let value: string | undefined
    let matched = false
    if (argument === longName || argument === shortName) {
      value = argv[index + 1]
      index++
      matched = true
    } else {
      const matchingName = [longName, shortName].find((name) => argument.startsWith(`${name}=`))
      if (matchingName) {
        value = argument.slice(matchingName.length + 1)
        matched = true
      } else if (argument.startsWith(shortName) && argument.length > shortName.length) {
        value = argument.slice(shortName.length)
        matched = true
      }
    }

    if (matched) {
      selection = {supplied: true, value, occurrences: selection.occurrences + 1}
    }
  }

  return selection
}

function environmentValue(env: NodeJS.ProcessEnv, name: string): SuppliedValue {
  const value = env[name]
  return value === undefined ? {supplied: false, occurrences: 0} : {supplied: true, value, occurrences: 1}
}

function flagString(flags: FlagValues, name: string): string | undefined {
  const value = flags[name]
  return typeof value === 'string' ? value : undefined
}

function rawSelections(flags: FlagValues, argv: string[], env: NodeJS.ProcessEnv): RawSelections {
  const cliStore = argvValue(argv, '--store', '-s')
  const cliEnvironment = argvValue(argv, '--environment', '-e')

  return {
    cliStore: {
      supplied: cliStore.supplied,
      value: cliStore.value ?? (cliStore.supplied ? flagString(flags, 'store') : undefined),
      occurrences: cliStore.occurrences,
    },
    cliEnvironment: {
      supplied: cliEnvironment.supplied,
      value: cliEnvironment.value ?? (cliEnvironment.supplied ? flagString(flags, 'environment') : undefined),
      occurrences: cliEnvironment.occurrences,
    },
    environmentStore: environmentValue(env, 'SHOPIFY_FLAG_STORE'),
    environmentName: environmentValue(env, 'SHOPIFY_FLAG_ENVIRONMENT'),
  }
}

function normalizeTrust(trust: Extract<ThemeProjectTrust, {state: 'configured'}>): NormalizedTrust {
  const environmentsByName = new Map<string, TrustedThemeEnvironment>()
  const environmentsByStore = new Map<string, TrustedThemeEnvironment>()

  for (const environment of trust.environments) {
    const normalizedEnvironment = {...environment, store: normalizeStoreFqdn(environment.store)}
    environmentsByName.set(environment.name, normalizedEnvironment)
    environmentsByStore.set(normalizedEnvironment.store, normalizedEnvironment)
  }

  return {environmentsByName, environmentsByStore}
}

function targetForEnvironment(
  environment: TrustedThemeEnvironment,
  source: StoreSelectionSource,
  implicit: boolean,
): AirlockTarget {
  return {
    environment: environment.name,
    store: environment.store,
    source,
    implicit,
  }
}

function unknownStoreError(store: string, source: StoreSelectionSource): ThemeAirlockError {
  return new ThemeAirlockError(`Store ${store} is not configured for this theme project.`, 'unknown-store', [
    {store, source, implicit: false},
  ])
}

function invalidStoreError(value: string, source: string): ThemeAirlockError {
  return new ThemeAirlockError(`Invalid store value for ${source}: ${value}.`, 'invalid-store')
}

function assertSelectionHasValue(
  selection: SuppliedValue,
  source: string,
  reason: 'unknown-store' | 'unknown-environment',
): void {
  if (!selection.supplied || (selection.value !== undefined && selection.value.length > 0)) return

  throw new ThemeAirlockError(`${source} requires a value.`, reason)
}

function normalizeSelectedStore(value: string | undefined, sourceName: string): string | undefined {
  if (value === undefined) return undefined

  try {
    return normalizeStoreFqdn(value)
  } catch {
    throw invalidStoreError(value, sourceName)
  }
}

function assertNoRepeatedSelection(selection: SuppliedValue, name: string): void {
  if (selection.occurrences < 2) return

  throw new ThemeAirlockError(`Multiple ${name} selections were provided. Provide only one.`, 'conflicting-selection')
}

function assertCompatibleStoreSelections(cliStore?: string, environmentStore?: string): void {
  if (cliStore === undefined || environmentStore === undefined || cliStore === environmentStore) return

  throw new ThemeAirlockError(
    `Store selections conflict: --store selects ${cliStore}, while SHOPIFY_FLAG_STORE selects ${environmentStore}.`,
    'conflicting-selection',
  )
}

function selectedEnvironmentName(selections: RawSelections): string | undefined {
  return selections.cliEnvironment.supplied ? selections.cliEnvironment.value : selections.environmentName.value
}

export function resolveSingleAirlockTarget(options: {
  trust: ThemeProjectTrust
  flags: FlagValues
  argv: string[]
  env: NodeJS.ProcessEnv
}):
  | AirlockTarget
  | {
      bootstrap: true
      candidate?: string
      proposedEnvironment?: string
      allowRememberedCandidate: boolean
    } {
  const selections = rawSelections(options.flags, options.argv, options.env)
  assertNoRepeatedSelection(selections.cliStore, '--store')
  assertNoRepeatedSelection(selections.cliEnvironment, '--environment')
  assertSelectionHasValue(selections.cliStore, '--store', 'unknown-store')
  assertSelectionHasValue(selections.environmentStore, 'SHOPIFY_FLAG_STORE', 'unknown-store')

  const cliStore = normalizeSelectedStore(selections.cliStore.value, '--store')
  const environmentStore = normalizeSelectedStore(selections.environmentStore.value, 'SHOPIFY_FLAG_STORE')
  assertCompatibleStoreSelections(cliStore, environmentStore)

  assertSelectionHasValue(selections.cliEnvironment, '--environment', 'unknown-environment')
  assertSelectionHasValue(selections.environmentName, 'SHOPIFY_FLAG_ENVIRONMENT', 'unknown-environment')

  const environmentName = selectedEnvironmentName(selections)
  const selectedStore = selections.cliStore.supplied ? cliStore : environmentStore

  if (options.trust.state === 'unconfigured') {
    return {
      bootstrap: true,
      ...(selectedStore === undefined ? {} : {candidate: selectedStore}),
      ...(environmentName === undefined ? {} : {proposedEnvironment: environmentName}),
      allowRememberedCandidate:
        !selections.cliStore.supplied &&
        !selections.environmentStore.supplied &&
        !selections.cliEnvironment.supplied &&
        !selections.environmentName.supplied,
    }
  }

  const {environmentsByName, environmentsByStore} = normalizeTrust(options.trust)

  if (environmentName !== undefined) {
    const environment = environmentsByName.get(environmentName)
    if (!environment) {
      throw new ThemeAirlockError(
        `Environment "${environmentName}" is not configured for this theme project.`,
        'unknown-environment',
      )
    }

    if (selectedStore !== undefined && selectedStore !== environment.store) {
      throw new ThemeAirlockError(
        `Environment "${environmentName}" selects ${environment.store}, but the store selection resolves to ${selectedStore}.`,
        'conflicting-selection',
      )
    }

    return targetForEnvironment(environment, 'explicit-environment', false)
  }

  if (selectedStore !== undefined) {
    const source = selections.cliStore.supplied ? 'explicit-store' : 'environment-variable'
    const environment = environmentsByStore.get(selectedStore)
    if (!environment) throw unknownStoreError(selectedStore, source)
    return targetForEnvironment(environment, source, false)
  }

  const defaultEnvironment = environmentsByName.get('default')
  if (defaultEnvironment) return targetForEnvironment(defaultEnvironment, 'default', true)

  if (environmentsByStore.size === 1) {
    const soleEnvironment = environmentsByStore.values().next().value as TrustedThemeEnvironment
    return targetForEnvironment(soleEnvironment, 'sole-store', true)
  }

  throw new ThemeAirlockError(
    'Multiple trusted stores are configured. Use --environment or --store to select one.',
    'ambiguous-selection',
  )
}

function normalizeBatchStore(environment: {name: string; store?: string}): string {
  if (environment.store === undefined) {
    throw new ThemeAirlockError(
      `Invalid batch environment "${environment.name}": a store is required.`,
      'invalid-batch',
    )
  }

  try {
    return normalizeStoreFqdn(environment.store)
  } catch {
    throw new ThemeAirlockError(
      `Invalid batch environment "${environment.name}": ${environment.store} is not a valid store.`,
      'invalid-batch',
    )
  }
}

export function resolveBatchAirlockTargets(options: {
  trust: ThemeProjectTrust
  environments: {name: string; store?: string}[]
}): AirlockTarget[] {
  if (options.trust.state === 'unconfigured') {
    throw new ThemeAirlockError(
      "Can't resolve batch environments for an unconfigured theme project.",
      'unconfigured-project',
    )
  }

  const {environmentsByName} = normalizeTrust(options.trust)
  const normalizedRequests = options.environments.map((environment) => ({
    name: environment.name,
    store: normalizeBatchStore(environment),
  }))

  const validatedEnvironments = normalizedRequests.map((requestedEnvironment) => {
    const configuredEnvironment = environmentsByName.get(requestedEnvironment.name)
    if (!configuredEnvironment) {
      throw new ThemeAirlockError(
        `Invalid batch environment "${requestedEnvironment.name}": it is not configured for this theme project.`,
        'invalid-batch',
      )
    }

    if (requestedEnvironment.store !== configuredEnvironment.store) {
      throw new ThemeAirlockError(
        `Invalid batch environment "${requestedEnvironment.name}": ${requestedEnvironment.store} does not match configured store ${configuredEnvironment.store}.`,
        'invalid-batch',
      )
    }

    return configuredEnvironment
  })

  return validatedEnvironments.map((environment) => targetForEnvironment(environment, 'explicit-environment', false))
}
