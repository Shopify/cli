import {AbortError} from '@shopify/cli-kit/node/error'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'

type DevelopmentThemeId = string

interface ThemeLocalStorageSchema {
  themeStore: string
}

interface DevelopmentThemeLocalStorageSchema {
  [themeStore: string]: DevelopmentThemeId
}

interface ThemeStorePasswordSchema {
  [themeStore: string]: string
}

let _themeLocalStorageInstance: LocalStorage<ThemeLocalStorageSchema> | undefined
let _developmentThemeLocalStorageInstance: LocalStorage<DevelopmentThemeLocalStorageSchema> | undefined
let _replThemeLocalStorageInstance: LocalStorage<DevelopmentThemeLocalStorageSchema> | undefined
let _themeStorePasswordStorageInstance: LocalStorage<ThemeStorePasswordSchema> | undefined

function themeLocalStorage() {
  if (!_themeLocalStorageInstance) {
    _themeLocalStorageInstance = new LocalStorage<ThemeLocalStorageSchema>({projectName: 'shopify-cli-theme-conf'})
  }
  return _themeLocalStorageInstance
}

function developmentThemeLocalStorage() {
  if (!_developmentThemeLocalStorageInstance) {
    _developmentThemeLocalStorageInstance = new LocalStorage<DevelopmentThemeLocalStorageSchema>({
      projectName: 'shopify-cli-development-theme-config',
    })
  }
  return _developmentThemeLocalStorageInstance
}

function replThemeLocalStorage() {
  if (!_replThemeLocalStorageInstance) {
    _replThemeLocalStorageInstance = new LocalStorage<DevelopmentThemeLocalStorageSchema>({
      projectName: 'shopify-cli-repl-theme-config',
    })
  }
  return _replThemeLocalStorageInstance
}

function themeStorePasswordStorage() {
  if (!_themeStorePasswordStorageInstance) {
    _themeStorePasswordStorageInstance = new LocalStorage<ThemeStorePasswordSchema>({
      projectName: 'shopify-cli-theme-store-password',
    })
  }
  return _themeStorePasswordStorageInstance
}

export function getThemeStore() {
  return themeLocalStorage().get('themeStore')
}

export function setThemeStore(store: string) {
  themeLocalStorage().set('themeStore', store)
}

export function getDevelopmentTheme(): string | undefined {
  outputDebug(outputContent`Getting development theme...`)
  return withOptionalThemeStore((themeStore) => {
    return developmentThemeLocalStorage().get(themeStore)
  })
}

export function setDevelopmentTheme(theme: string): void {
  outputDebug(outputContent`Setting development theme...`)
  developmentThemeLocalStorage().set(requireThemeStore(), theme)
}

export function removeDevelopmentTheme(): void {
  outputDebug(outputContent`Removing development theme...`)
  return withOptionalThemeStore((themeStore) => {
    developmentThemeLocalStorage().delete(themeStore)
  })
}

export function getREPLTheme(): string | undefined {
  outputDebug(outputContent`Getting REPL theme...`)
  return withOptionalThemeStore((themeStore) => {
    return replThemeLocalStorage().get(themeStore)
  })
}

export function setREPLTheme(theme: string): void {
  outputDebug(outputContent`Setting REPL theme to ${theme}...`)
  replThemeLocalStorage().set(requireThemeStore(), theme)
}

export function removeREPLTheme(): void {
  outputDebug(outputContent`Removing REPL theme...`)
  replThemeLocalStorage().delete(requireThemeStore())
}

export function getStorefrontPassword(): string | undefined {
  return withOptionalThemeStore((themeStore) => {
    outputDebug(outputContent`Getting storefront password for shop ${themeStore}...`)
    return themeStorePasswordStorage().get(themeStore)
  })
}

export function setStorefrontPassword(password: string): void {
  const themeStore = requireThemeStore()
  outputDebug(outputContent`Setting storefront password for shop ${themeStore}...`)
  themeStorePasswordStorage().set(themeStore, password)
}

export function removeStorefrontPassword(): void {
  const themeStore = requireThemeStore()
  outputDebug(outputContent`Removing storefront password for ${themeStore}...`)
  themeStorePasswordStorage().delete(themeStore)
}

function requireThemeStore(): string {
  const themeStore = getThemeStore()
  if (!themeStore) {
    throw new AbortError('Theme store is not set')
  }
  return themeStore
}

function withOptionalThemeStore<T>(callback: (themeStore: string) => T | undefined): T | undefined {
  const themeStore = getThemeStore()
  if (!themeStore) {
    return
  }
  return callback(themeStore)
}
