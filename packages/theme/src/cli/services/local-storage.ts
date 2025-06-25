import {BugError} from '@shopify/cli-kit/node/error'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'

type DevelopmentThemeId = string

export interface ThemeLocalStorageSchema {
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

export function getThemeStore(storage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage()) {
  return storage.get('themeStore')
}

export function setThemeStore(store: string, storage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage()) {
  storage.set('themeStore', store)
}

export function getDevelopmentTheme(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): string | undefined {
  outputDebug(outputContent`Getting development theme...`)
  const themeStore = assertThemeStoreExists(themeStorage)
  outputDebug(outputContent`Theme store: ${themeStore}`)
  const developmentThemeId = developmentThemeLocalStorage().get(themeStore)
  outputDebug(outputContent`Development theme ID: ${developmentThemeId || 'undefined'}`)
  return developmentThemeId
}

export function setDevelopmentTheme(
  theme: string,
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  outputDebug(outputContent`Setting development theme...`)
  developmentThemeLocalStorage().set(assertThemeStoreExists(themeStorage), theme)
}

export function removeDevelopmentTheme(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  outputDebug(outputContent`Removing development theme...`)
  developmentThemeLocalStorage().delete(assertThemeStoreExists(themeStorage))
}

export function getREPLTheme(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): string | undefined {
  outputDebug(outputContent`Getting REPL theme...`)
  return replThemeLocalStorage().get(assertThemeStoreExists(themeStorage))
}

export function setREPLTheme(
  theme: string,
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  outputDebug(outputContent`Setting REPL theme to ${theme}...`)
  replThemeLocalStorage().set(assertThemeStoreExists(themeStorage), theme)
}

export function removeREPLTheme(themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage()): void {
  outputDebug(outputContent`Removing REPL theme...`)
  replThemeLocalStorage().delete(assertThemeStoreExists(themeStorage))
}

export function getStorefrontPassword(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): string | undefined {
  const themeStore = assertThemeStoreExists(themeStorage)
  outputDebug(outputContent`Getting storefront password for shop ${themeStore}...`)
  return themeStorePasswordStorage().get(themeStore)
}

export function setStorefrontPassword(
  password: string,
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  const themeStore = assertThemeStoreExists(themeStorage)
  outputDebug(outputContent`Setting storefront password for shop ${themeStore}...`)
  themeStorePasswordStorage().set(themeStore, password)
}

export function removeStorefrontPassword(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  const themeStore = assertThemeStoreExists(themeStorage)
  outputDebug(outputContent`Removing storefront password for ${themeStore}...`)
  themeStorePasswordStorage().delete(themeStore)
}

function assertThemeStoreExists(storage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage()): string {
  const themeStore = getThemeStore(storage)
  if (!themeStore) {
    throw new BugError(
      'Theme store is not set. This indicates an unexpected issue with the CLI. Please report this to the Shopify CLI team.',
      [
        'It may be possible to recover by running',
        {command: 'shopify theme list --store <store>'},
        '(setting the store flag to the store you wish to use) and then running the command again.',
      ],
    )
  }
  return themeStore
}
