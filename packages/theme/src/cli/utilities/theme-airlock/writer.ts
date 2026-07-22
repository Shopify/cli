import {loadThemeProjectTrust} from './config.js'
import {ThemeAirlockError} from './types.js'
import {configurationFileName} from '../../constants.js'
import {fileHasWritePermissions, fileRealPath} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname, resolvePath} from '@shopify/cli-kit/node/path'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import lockfile from 'proper-lockfile'

const configurationLockOptions = {
  realpath: false,
  retries: {retries: 10, factor: 1, minTimeout: 25, maxTimeout: 100},
}
const maximumConfigurationPathRedirects = 3

type TrustedThemeTrust = Awaited<ReturnType<typeof loadThemeProjectTrust>>
interface TrustedEnvironmentResult {
  path: string
  store: string
}
type LockedWriteResult =
  | {kind: 'redirect'; path: string; displayPath: string}
  | {kind: 'written'; value: TrustedEnvironmentResult}

async function canonicalConfigurationPath(path: string): Promise<string> {
  try {
    return await fileRealPath(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return path
    throw error
  }
}

function normalizeRequestedStore(store: string): string {
  try {
    return normalizeStoreFqdn(store)
  } catch {
    throw new ThemeAirlockError(`Invalid store value for theme trust: ${store}.`, 'invalid-store')
  }
}

function conflictError(message: string, reason: 'environment-conflict' | 'store-conflict'): ThemeAirlockError {
  return new ThemeAirlockError(message, reason)
}

async function assertWritable(path: string, description: string): Promise<void> {
  if (await fileHasWritePermissions(path)) return

  throw new ThemeAirlockError(`Unable to write ${description} at ${path}: permission denied.`, 'permission-denied')
}

async function writeTrustedThemeEnvironment(options: {
  configurationPath: string
  displayPath: string
  trust: TrustedThemeTrust
  environment: string
  normalizedStore: string
}): Promise<TrustedEnvironmentResult> {
  const {configurationPath, displayPath, trust, environment, normalizedStore} = options

  if (trust.state === 'configured') {
    const existingEnvironment = trust.environments.find(({name}) => name === environment)
    if (existingEnvironment) {
      if (existingEnvironment.store === normalizedStore) return {path: displayPath, store: normalizedStore}

      throw conflictError(
        `Environment "${environment}" is already trusted for ${existingEnvironment.store}, not ${normalizedStore}.`,
        'environment-conflict',
      )
    }

    const existingStore = trust.environments.find(({store}) => store === normalizedStore)
    if (existingStore) {
      throw conflictError(
        `Store ${normalizedStore} is already trusted under environment "${existingStore.name}".`,
        'store-conflict',
      )
    }
  }

  const changes = {environments: {[environment]: {store: normalizedStore}}}

  if (trust.path) {
    await assertWritable(configurationPath, 'theme configuration')
    const configuration = await TomlFile.read(configurationPath)
    await configuration.patch(changes)
  } else {
    await assertWritable(dirname(configurationPath), 'theme configuration directory')
    const configuration = new TomlFile(configurationPath, {})
    await configuration.replace(changes)
  }

  return {path: displayPath, store: normalizedStore}
}

function configurationLockError(configurationPath: string): ThemeAirlockError {
  return new ThemeAirlockError(
    `Unable to acquire the theme configuration lock at ${configurationPath}.`,
    'configuration-lock-failed',
  )
}

async function lockAndWriteConfiguration(options: {
  themePath: string
  configurationPath: string
  displayPath: string
  environment: string
  normalizedStore: string
}): Promise<LockedWriteResult> {
  let releaseLock: (() => Promise<void>) | undefined
  try {
    try {
      releaseLock = await lockfile.lock(options.configurationPath, configurationLockOptions)
    } catch {
      throw configurationLockError(options.configurationPath)
    }

    const freshTrust = await loadThemeProjectTrust(options.themePath)
    const freshDisplayPath = resolvePath(freshTrust.path ?? joinPath(options.themePath, configurationFileName))
    const freshConfigurationPath = await canonicalConfigurationPath(freshDisplayPath)
    if (freshConfigurationPath !== options.configurationPath) {
      return {kind: 'redirect', path: freshConfigurationPath, displayPath: freshDisplayPath}
    }

    const value = await writeTrustedThemeEnvironment({
      configurationPath: options.configurationPath,
      displayPath: freshDisplayPath,
      trust: freshTrust,
      environment: options.environment,
      normalizedStore: options.normalizedStore,
    })
    return {kind: 'written', value}
  } finally {
    if (releaseLock) await releaseLock()
  }
}

async function writeWithConfigurationRedirects(options: {
  themePath: string
  configurationPath: string
  environment: string
  normalizedStore: string
  redirects: number
  displayPath: string
}): Promise<TrustedEnvironmentResult> {
  const result = await lockAndWriteConfiguration(options)
  if (result.kind === 'written') return result.value
  if (options.redirects >= maximumConfigurationPathRedirects) throw configurationLockError(result.path)

  return writeWithConfigurationRedirects({
    ...options,
    configurationPath: result.path,
    displayPath: result.displayPath,
    redirects: options.redirects + 1,
  })
}

export async function addTrustedThemeEnvironment(options: {
  themePath: string
  environment: string
  store: string
}): Promise<TrustedEnvironmentResult> {
  const normalizedStore = normalizeRequestedStore(options.store)
  const initialTrust = await loadThemeProjectTrust(options.themePath)
  const displayPath = resolvePath(initialTrust.path ?? joinPath(options.themePath, configurationFileName))
  const configurationPath = await canonicalConfigurationPath(displayPath)

  return writeWithConfigurationRedirects({
    themePath: options.themePath,
    configurationPath,
    displayPath,
    environment: options.environment,
    normalizedStore,
    redirects: 0,
  })
}
