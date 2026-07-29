import {addTrustedThemeEnvironment} from './writer.js'
import {ThemeAirlockError} from './types.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

import type {AirlockTarget} from './types.js'

interface BootstrapOptions<TSession> {
  themePath: string
  candidate?: string
  rememberedStore?: string
  proposedEnvironment?: string
  confirmStore: (store: string) => Promise<'trust' | 'choose' | 'cancel'>
  promptStore: () => Promise<string | undefined>
  promptEnvironment: () => Promise<string | undefined>
  authenticate: (store: string) => Promise<TSession>
}

function bootstrapCancelled(message: string): ThemeAirlockError {
  return new ThemeAirlockError(message, 'bootstrap-cancelled')
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0
}

function normalizeBootstrapStore(store: string): string {
  try {
    return normalizeStoreFqdn(store)
  } catch {
    throw new ThemeAirlockError(`Invalid store value during theme bootstrap: ${store}.`, 'invalid-store')
  }
}

function requiredBootstrapValue(value: string | undefined, message: string): string {
  if (hasValue(value)) return value
  throw bootstrapCancelled(message)
}

export async function bootstrapThemeAirlock<TSession>(
  options: BootstrapOptions<TSession>,
): Promise<{target: AirlockTarget; session: TSession; configurationPath: string}> {
  let selectedStore: string | undefined
  const suppliedStore = options.candidate ?? options.rememberedStore

  if (suppliedStore === undefined) {
    selectedStore = await options.promptStore()
  } else {
    const confirmation = await options.confirmStore(suppliedStore)
    if (confirmation === 'cancel') {
      throw bootstrapCancelled('Theme bootstrap was cancelled while selecting a store.')
    }
    selectedStore = confirmation === 'trust' ? suppliedStore : await options.promptStore()
  }

  const selectedStoreValue = requiredBootstrapValue(
    selectedStore,
    'Theme bootstrap was cancelled without selecting a store.',
  )
  const normalizedStore = normalizeBootstrapStore(selectedStoreValue)
  const environment = requiredBootstrapValue(
    options.proposedEnvironment ?? (await options.promptEnvironment()),
    'Theme bootstrap was cancelled without selecting an environment.',
  )

  const session = await options.authenticate(normalizedStore)
  const configuration = await addTrustedThemeEnvironment({
    themePath: options.themePath,
    environment,
    store: normalizedStore,
  })

  return {
    target: {
      environment,
      store: configuration.store,
      source: 'bootstrap',
      implicit: false,
    },
    session,
    configurationPath: configuration.path,
  }
}
