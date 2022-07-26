import {ExternalExtensionTypes} from '../../constants.js'
import {error, path} from '@shopify/cli-kit'
import fs from 'fs'

const L10N_FILE_SIZE_LIMIT = 16 * 1024
const L10N_BUNDLE_SIZE_LIMIT = 256 * 1024
const CHECKOUT_UI_EXTENSION_KEY: ExternalExtensionTypes = 'checkout_ui'

const MissingDefaultLanguageError = () => {
  return new error.Abort(
    `Missing default language in ${CHECKOUT_UI_EXTENSION_KEY} configuration`,
    'Make sure to have a {locale}.default.json file in your locales directory',
  )
}

const BigBundleError = () => {
  return new error.Abort(
    `Error loading ${CHECKOUT_UI_EXTENSION_KEY}`,
    `Total size of all locale files must be less than ${L10N_BUNDLE_SIZE_LIMIT}`,
  )
}

const BigFileError = (filename: string) => {
  return new error.Abort(
    `Error loading ${CHECKOUT_UI_EXTENSION_KEY}`,
    `Locale file ${filename} size must be less than ${L10N_FILE_SIZE_LIMIT}`,
  )
}

const EmptyFileError = (filename: string) => {
  return new error.Abort(`Error loading ${CHECKOUT_UI_EXTENSION_KEY}`, `Locale file ${filename} can't be empty`)
}

const MultipleDefaultError = () => {
  return new error.Abort(
    `Error loading ${CHECKOUT_UI_EXTENSION_KEY}`,
    `There must be one (and only one) locale identified as the default locale: e.g. "en.default.json"`,
  )
}

export async function loadLocalesConfig(extensionPath: string) {
  const localesPaths = await path.glob(path.join(extensionPath, 'locales/*.json'))
  if (localesPaths.length === 0) return {}

  // Bundle validations
  const totalBundleSize = bundleSize(localesPaths)
  const defaultLanguageCode = findDefaultLocale(localesPaths)
  if (defaultLanguageCode.length === 0) throw MissingDefaultLanguageError()
  if (defaultLanguageCode.length > 1) throw MultipleDefaultError()
  if (totalBundleSize > L10N_BUNDLE_SIZE_LIMIT) throw BigBundleError()

  // Locale validations
  for (const locale of localesPaths) {
    const size = fs.statSync(locale).size
    if (size > L10N_FILE_SIZE_LIMIT) throw BigFileError(locale)
    if (size === 0) throw EmptyFileError(locale)
  }

  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
    const localeCode = path.basename(localePath).split('.')[0]
    const locale = fs.readFileSync(localePath, 'base64')
    all[localeCode] = locale
  }
  return all
}

function bundleSize(localesPaths: string[]) {
  return localesPaths.map((locale) => fs.statSync(locale).size).reduce((acc, size) => acc + size, 0)
}
