/**
 * These translation utilities were adapted from https://github.com/Shopify/checkout-web/blob/master/app/utilities/development-mode/i18n-utilities.tsx
 * */

type Translation = string | {[key: string]: Translation}

export interface Localization {
  defaultLocale: string
  translations: {[key: string]: {[key: string]: Translation}}
  lastUpdated: number
}

export interface FlattenedLocalization {
  extensionLocale: string
  translations: string
  lastUpdated: number
}

export interface LocalesOptions {
  user: string
  shop?: string
}

interface TranslationDictionary {
  [key: string]: string | TranslationDictionary
}

/**
 * This is a flattened dictionary of extension translations for the active locale.
 *
 * Here are some examples for the 'en' locale.
 *
 * Nested keys are dot separated. Consider this translation definition:
 *
 * ```
 * {
 *   "greetings": {
 *     "hello": "Hello {{user}}"
 *   }
 * }
 * ```
 *
 * It would be represented in this flattened dictionary as:
 * ```
 * {
 *   "greetings.hello": "Hello {{user}}"
 * }
 * ```
 * Pluralized translations will also be flattened. Consider this definition:
 * ```
 * {
 *   "loyaltyPointsRemaining": {
 *     "one": "You have {{count}} loyalty point",
 *     "other": "You have {{count}} loyalty points",
 *   }
 * }
 * ```
 * It would be represented in this flattened dictionary as:
 * ```
 * {
 *   "loyaltyPointsRemaining.one":  "You have {{count}} loyalty point",
 *   "loyaltyPointsRemaining.other": "You have {{count}} loyalty points",
 * }
 * ```
 */
interface ExtensionTranslationMap {
  [key: string]: string
}

export const TRANSLATED_KEYS = ['localization', 'name', 'description']
/**
 * From a nested dictionary like the following :
 *
 * ```typescript
 * const dictionary = {
 *   Foo: {
 *     Bar: {
 *        fooBar: 'something'
 *     }
 *   }
 * }
 *
 * Returns a map containing this pair : {'Foo.Bar.fooBar': 'something'}
 * ```
 */
function dictionaryToFlatMap(dictionary: TranslationDictionary) {
  const map = new Map<string, string>()

  traverseDictionary(dictionary, (key, value) => map.set(key, value))

  return map
}

function traverseDictionary(
  dictionary: TranslationDictionary,
  callback: (key: string, value: string) => void,
  keyPrefix?: string,
) {
  Object.keys(dictionary).forEach((key: string) => {
    const value = dictionary[key]
    const translationKey = keyPrefix ? `${keyPrefix}.${key}` : key

    if (value == null) {
      return
    }

    if (typeof value === 'string') {
      // eslint-disable-next-line node/callback-return
      callback(translationKey, value)
    } else {
      traverseDictionary(value, callback, translationKey)
    }
  })
}

export function flattenDevExtensionTranslations(localization: Localization, locale: string): ExtensionTranslationMap {
  const defaultTranslations = getFlatMap(localization.translations[localization.defaultLocale])

  const nonRegionalLocale = getNonRegionalLocale(locale)
  const nonRegionalTranslations = getFlatMap(localization.translations[nonRegionalLocale])

  const userLocaleTranslations = getFlatMap(localization.translations[locale])

  return convertMapToExtensionTranslationMap(
    new Map([...defaultTranslations, ...nonRegionalTranslations, ...userLocaleTranslations]),
  )
}

function getFlatMap(translationDictionary: TranslationDictionary | undefined) {
  if (translationDictionary) {
    return dictionaryToFlatMap(translationDictionary)
  }
  return new Map<string, string>()
}

export function resolveDevExtensionLocale(
  localization: Localization,
  locales: {
    user: string
    shop?: string
  },
): string {
  const extensionLocales = new Set(Object.keys(localization.translations))

  // 0. If no translations, use the user's locale
  if (extensionLocales.size === 0) return locales.user

  // 1. Attempt to match the user's locale exactly
  if (extensionLocales.has(locales.user)) return locales.user

  // 2. Attempt to match the non-regional part of the user's locale (i.e. 'fr-CA' becomes 'fr')
  const nonRegionalUserLocale = getNonRegionalLocale(locales.user)
  if (extensionLocales.has(nonRegionalUserLocale)) return nonRegionalUserLocale

  // 3. Attempt to match the shop's default locale exactly
  if (locales.shop && extensionLocales.has(locales.shop)) return locales.shop

  // 4. Attempt to match the non-regional part of the shop's default locale (i.e. 'fr-CA' becomes 'fr')
  const nonRegionalShopLocale = locales.shop && getNonRegionalLocale(locales.shop)
  if (nonRegionalShopLocale && extensionLocales.has(nonRegionalShopLocale)) return nonRegionalShopLocale

  // 5. Finally, return the default locale as a fallback
  return localization.defaultLocale
}

function convertMapToExtensionTranslationMap(map: Map<string, string>): ExtensionTranslationMap {
  const extTransMap: ExtensionTranslationMap = {}
  for (const [key, value] of map) {
    extTransMap[key] = value
  }
  return extTransMap
}

function getNonRegionalLocale(locale: string): string {
  return locale.split('-')[0]
}

export function getFlattenedLocalization(
  localization?: FlattenedLocalization | Localization | null,
  locales?: LocalesOptions,
) {
  if (!localization || !locales) {
    return
  }

  if (isFlattenedTranslations(localization)) {
    return localization
  }

  const extensionLocale = resolveDevExtensionLocale(localization, locales)
  const translations = JSON.stringify(flattenDevExtensionTranslations(localization, extensionLocale))

  const flattenedLocalization: FlattenedLocalization = {
    extensionLocale,
    translations,
    lastUpdated: localization.lastUpdated,
  }
  return flattenedLocalization
}

export function isFlattenedTranslations(
  localization: Localization | FlattenedLocalization,
): localization is FlattenedLocalization {
  return (
    typeof localization.translations === 'string' &&
    Object.prototype.hasOwnProperty.call(localization, 'extensionLocale')
  )
}
