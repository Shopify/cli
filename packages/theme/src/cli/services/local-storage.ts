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

/**
 * Extracts the shop name from a store URL or name.
 * Removes protocols, domains (.myshopify.com, .shopify.io, etc), and trailing slashes.
 *
 * @param store - The store URL or name, e.g. "https://my-store.myshopify.com"
 * @returns The extracted shop name, e.g. "my-store"
 */
export function extractShopName(store: string): string {
  const cleanStore = store.replace(/^https?:\/\//, '')
  return cleanStore.replace(/\.(myshopify\.com|shopify\.io|spin\.dev|shop\.dev).*$/, '').replace(/\/$/, '')
}

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
  const shopName = extractShopName(assertThemeStoreExists(themeStorage))
  return developmentThemeLocalStorage().get(shopName)
}

export function setDevelopmentTheme(
  theme: string,
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  outputDebug(outputContent`Setting development theme...`)
  const shopName = extractShopName(assertThemeStoreExists(themeStorage))
  developmentThemeLocalStorage().set(shopName, theme)
}

export function removeDevelopmentTheme(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  outputDebug(outputContent`Removing development theme...`)
  const shopName = extractShopName(assertThemeStoreExists(themeStorage))
  developmentThemeLocalStorage().delete(shopName)
}

export function getREPLTheme(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): string | undefined {
  outputDebug(outputContent`Getting REPL theme...`)
  const shopName = extractShopName(assertThemeStoreExists(themeStorage))
  return replThemeLocalStorage().get(shopName)
}

export function setREPLTheme(
  theme: string,
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  outputDebug(outputContent`Setting REPL theme to ${theme}...`)
  const shopName = extractShopName(assertThemeStoreExists(themeStorage))
  replThemeLocalStorage().set(shopName, theme)
}

export function removeREPLTheme(themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage()): void {
  outputDebug(outputContent`Removing REPL theme...`)
  const shopName = extractShopName(assertThemeStoreExists(themeStorage))
  replThemeLocalStorage().delete(shopName)
}

export function getStorefrontPassword(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): string | undefined {
  const themeStore = assertThemeStoreExists(themeStorage)
  const shopName = extractShopName(themeStore)
  outputDebug(outputContent`Getting storefront password for shop ${themeStore}...`)
  return themeStorePasswordStorage().get(shopName)
}

export function setStorefrontPassword(
  password: string,
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  const themeStore = assertThemeStoreExists(themeStorage)
  const shopName = extractShopName(themeStore)
  outputDebug(outputContent`Setting storefront password for shop ${themeStore}...`)
  themeStorePasswordStorage().set(shopName, password)
}

export function removeStorefrontPassword(
  themeStorage: LocalStorage<ThemeLocalStorageSchema> = themeLocalStorage(),
): void {
  const themeStore = assertThemeStoreExists(themeStorage)
  const shopName = extractShopName(themeStore)
  outputDebug(outputContent`Removing storefront password for ${themeStore}...`)
  themeStorePasswordStorage().delete(shopName)
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
