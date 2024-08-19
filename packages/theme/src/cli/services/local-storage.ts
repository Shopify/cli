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
let _themeStoreLocalStorageInstance: LocalStorage<ThemeStorePasswordSchema> | undefined

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

function themeStoreLocalStorage() {
  if (!_themeStoreLocalStorageInstance) {
    _themeStoreLocalStorageInstance = new LocalStorage<ThemeStorePasswordSchema>({
      projectName: 'shopify-cli-theme-store-password',
    })
  }
  return _themeStoreLocalStorageInstance
}

export function getThemeStore() {
  return themeLocalStorage().get('themeStore')
}

export function setThemeStore(store: string) {
  themeLocalStorage().set('themeStore', store)
}

export function getDevelopmentTheme(): string | undefined {
  outputDebug(outputContent`Getting development theme...`)
  return developmentThemeLocalStorage().get(getThemeStore())
}

export function setDevelopmentTheme(theme: string): void {
  outputDebug(outputContent`Setting development theme...`)
  developmentThemeLocalStorage().set(getThemeStore(), theme)
}

export function removeDevelopmentTheme(): void {
  outputDebug(outputContent`Removing development theme...`)
  developmentThemeLocalStorage().delete(getThemeStore())
}

export function getREPLTheme(): string | undefined {
  outputDebug(outputContent`Getting REPL theme...`)
  return replThemeLocalStorage().get(getThemeStore())
}

export function setREPLTheme(theme: string): void {
  outputDebug(outputContent`Setting REPL theme to ${theme}...`)
  replThemeLocalStorage().set(getThemeStore(), theme)
}

export function removeREPLTheme(): void {
  outputDebug(outputContent`Removing REPL theme...`)
  replThemeLocalStorage().delete(getThemeStore())
}

export function getStorefrontPassword(): string | undefined {
  const themeStore = getThemeStore()
  outputDebug(outputContent`Getting storefront password for shop ${themeStore}...`)
  return themeStoreLocalStorage().get(getThemeStore())
}

export function setStorefrontPassword(password: string): void {
  const themeStore = getThemeStore()
  outputDebug(outputContent`Setting storefront password for shop ${themeStore}...`)
  themeStoreLocalStorage().set(themeStore, password)
}

export function removeStorefrontPassword(): void {
  const themeStore = getThemeStore()
  outputDebug(outputContent`Removing storefront password for ${themeStore}...`)
  themeStoreLocalStorage().delete(themeStore)
}
