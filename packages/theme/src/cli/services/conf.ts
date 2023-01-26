import {Conf} from '@shopify/cli-kit/node/conf'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'

const DEVELOPMENT_THEME_KEY = 'developmentTheme'

export interface ThemeConfSchema {
  themeStore: string
  developmentTheme: string
}

let _instance: Conf<ThemeConfSchema> | undefined

export function themeConf() {
  if (!_instance) {
    _instance = new Conf<ThemeConfSchema>({projectName: 'shopify-cli-theme-conf'})
  }
  return _instance
}

export function getDevelopmentTheme(): string | undefined {
  outputDebug(outputContent`Getting development theme...`)
  const config = themeConf()
  return config.get(DEVELOPMENT_THEME_KEY)
}

export function setDevelopmentTheme(theme: string): void {
  outputDebug(outputContent`Setting development theme...`)
  const config = themeConf()
  config.set(DEVELOPMENT_THEME_KEY, theme)
}

export function removeDevelopmentTheme(): void {
  outputDebug(outputContent`Removing development theme...`)
  const config = themeConf()
  config.reset(DEVELOPMENT_THEME_KEY)
}
