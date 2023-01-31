import {ensureThemeStore} from '../utilities/theme-store.js'
import {Conf} from '@shopify/cli-kit/node/conf'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'

type DevelopmentOrHostThemeId = string

export interface ThemeConfSchema {
  themeStore: string
}

interface DevelopmentThemeConfSchema {
  [themeStore: string]: DevelopmentOrHostThemeId
}

let _themeConfInstance: Conf<ThemeConfSchema> | undefined
let _developmentThemeConfInstance: Conf<DevelopmentThemeConfSchema> | undefined

export function themeConf() {
  if (!_themeConfInstance) {
    _themeConfInstance = new Conf<ThemeConfSchema>({projectName: 'shopify-cli-theme-conf'})
  }
  return _themeConfInstance
}

export function getThemeStore() {
  return themeConf().get('themeStore')
}

export function setThemeStore(store: string) {
  themeConf().set('themeStore', store)
}

export function developmentThemeConf() {
  if (!_developmentThemeConfInstance) {
    _developmentThemeConfInstance = new Conf<DevelopmentThemeConfSchema>({
      projectName: 'shopify-cli-development-theme-conf',
    })
  }
  return _developmentThemeConfInstance
}

export function getDevelopmentTheme(): string | undefined {
  outputDebug(outputContent`Getting development theme...`)
  return developmentThemeConf().get(ensureThemeStore({store: undefined}))
}

export function setDevelopmentTheme(theme: string): void {
  outputDebug(outputContent`Setting development theme...`)
  developmentThemeConf().set(ensureThemeStore({store: undefined}), theme)
}

export function removeDevelopmentTheme(): void {
  outputDebug(outputContent`Removing development theme...`)
  developmentThemeConf().reset(ensureThemeStore({store: undefined}))
}
