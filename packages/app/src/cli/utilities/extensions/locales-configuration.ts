import {error, path} from '@shopify/cli-kit'
import fs from 'fs'

const L10N_FILE_SIZE_LIMIT = 16 * 1024
const L10N_BUNDLE_SIZE_LIMIT = 256 * 1024

export async function loadLocalesConfig(extensionPath: string, extensionIdentifier: string) {
  const localesPaths = await path.glob(path.join(extensionPath, 'locales/*.json'))
  if (localesPaths.length === 0) return {}

  // Bundle validations
  const totalBundleSize = bundleSize(localesPaths)
  const defaultLanguageCode = findDefaultLocale(localesPaths)

  if (defaultLanguageCode.length === 0)
    throw new error.Abort(
      `Missing default language in ${extensionIdentifier} configuration`,
      'Make sure to have a {locale}.default.json file in your locales directory',
    )

  if (defaultLanguageCode.length > 1)
    throw new error.Abort(
      `Error loading ${extensionIdentifier}`,
      `There must be one (and only one) locale identified as the default locale: e.g. "en.default.json"`,
    )

  if (totalBundleSize > L10N_BUNDLE_SIZE_LIMIT)
    throw new error.Abort(
      `Error loading ${extensionIdentifier}`,
      `Total size of all locale files must be less than ${L10N_BUNDLE_SIZE_LIMIT}`,
    )

  // Locale validations
  for (const locale of localesPaths) {
    const size = fs.statSync(locale).size
    if (size > L10N_FILE_SIZE_LIMIT)
      throw new error.Abort(
        `Error loading ${extensionIdentifier}`,
        `Locale file ${locale} size must be less than ${L10N_FILE_SIZE_LIMIT}`,
      )
    if (size === 0)
      throw new error.Abort(`Error loading ${extensionIdentifier}`, `Locale file ${locale} can't be empty`)
  }

  return {
    default_locale: defaultLanguageCode[0],
    translations: getAllLocales(localesPaths),
  }
}

function findDefaultLocale(filePaths: string[]) {
  const defaultLocale = filePaths.filter((locale) => path.basename(locale).endsWith('.default.json'))
  return defaultLocale.map((locale) => path.basename(locale).split('.')[0])
}

function getAllLocales(localesPath: string[]) {
  const all: {[key: string]: string} = {}
  for (const localePath of localesPath) {
    const localeCode = path.basename(localePath).split('.')[0]!
    const locale = fs.readFileSync(localePath, 'base64')
    all[localeCode] = locale
  }
  return all
}

function bundleSize(localesPaths: string[]) {
  return localesPaths.map((locale) => fs.statSync(locale).size).reduce((acc, size) => acc + size, 0)
}
