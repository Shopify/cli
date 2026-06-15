import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {isUtf8} from 'node:buffer'
import fs from 'fs'

export async function loadLocalesConfig(extensionPath: string, extensionIdentifier: string) {
  const localesPaths = await glob(joinPath(extensionPath, 'locales/*.json'))
  if (!localesPaths || localesPaths.length === 0) return {}

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
    translations: getAllLocales(localesPaths, extensionIdentifier),
  }
}

function findDefaultLocale(filePaths: string[]) {
  const defaultLocale = filePaths.filter((locale) => basename(locale).endsWith('.default.json'))
  return defaultLocale.map((locale) => basename(locale).split('.')[0])
}

function getAllLocales(localesPath: string[], extensionIdentifier: string) {
  const all: {[key: string]: string} = {}
  for (const localePath of localesPath) {
    const localeCode = failIfUnset(basename(localePath).split('.')[0], 'Locale code is unset')
    const localeBuffer = fs.readFileSync(localePath)
    // Validate UTF-8 client-side: the server decodes these as UTF-8 strings and a
    // single invalid byte sequence aborts the upload with an unhelpful error.
    if (!isUtf8(localeBuffer)) {
      throw new AbortError(
        `Error loading ${extensionIdentifier}`,
        `Locale file ${localePath} contains invalid UTF-8 byte sequences. Re-save the file using UTF-8 encoding.`,
      )
    }
    all[localeCode] = localeBuffer.toString('base64')
  }
  return all
}

function failIfUnset<T>(value: T | undefined, message: string) {
  if (value === undefined) {
    throw new BugError(message)
  }
  return value
}
