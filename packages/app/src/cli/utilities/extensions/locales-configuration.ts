import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import fs from 'fs'

export async function loadLocalesConfig(extensionPath: string, extensionIdentifier: string) {
  const localesPaths = await glob(joinPath(extensionPath, 'locales/*.json'))
  if (localesPaths.length === 0) return {}

  // Bundle validations
  const defaultLanguageCode = findDefaultLocale(localesPaths)

  if (defaultLanguageCode.length === 0)
    throw new AbortError(
      `Missing default language in ${extensionIdentifier} configuration`,
      'Make sure to have a {locale}.default.json file in your locales directory',
    )

  if (defaultLanguageCode.length > 1)
    throw new AbortError(
      `Error loading ${extensionIdentifier}`,
      `There must be one (and only one) locale identified as the default locale: e.g. "en.default.json"`,
    )

  // Locale validations
  for (const locale of localesPaths) {
    const size = fs.statSync(locale).size
    if (size === 0) throw new AbortError(`Error loading ${extensionIdentifier}`, `Locale file ${locale} can't be empty`)
  }

  return {
    default_locale: defaultLanguageCode[0],
    translations: getAllLocales(localesPaths),
  }
}

function findDefaultLocale(filePaths: string[]) {
  const defaultLocale = filePaths.filter((locale) => basename(locale).endsWith('.default.json'))
  return defaultLocale.map((locale) => basename(locale).split('.')[0])
}

function getAllLocales(localesPath: string[]) {
  const all: {[key: string]: string} = {}
  for (const localePath of localesPath) {
    const localeCode = failIfUnset(basename(localePath).split('.')[0], 'Locale code is unset')
    const locale = fs.readFileSync(localePath, 'base64')
    all[localeCode] = locale
  }
  return all
}

function failIfUnset<T>(value: T | undefined, message: string) {
  if (value === undefined) {
    throw new BugError(message)
  }
  return value
}
