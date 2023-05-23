import {flattenDevExtensionTranslations, resolveDevExtensionLocale, getFlattenedLocalization} from './i18n'

/**
 * These tests were adapted from https://github.com/Shopify/checkout-web/blob/master/app/utilities/development-mode/tests/i18n-utilities.test.tsx
 * */

describe('resolveDevExtensionLocale()', () => {
  test('returns the user locale if it is provided as a supported locale', () => {
    const userLocale = 'fr-FR'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
          },
        },
        de: {
          greetings: {
            hello: 'Hallo',
          },
        },
        'fr-FR': {
          greetings: {
            hello: 'Bonjour',
          },
        },
      },
    }

    const extensionLocale = resolveDevExtensionLocale(localization, {user: userLocale})

    expect(extensionLocale).toBe(userLocale)
  })

  test('returns the non-regional user locale if there is no exact match with user locale', async () => {
    const userLocale = 'de-DE'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
          },
        },
        de: {
          greetings: {
            hello: 'Hallo',
          },
        },
        'fr-FR': {
          greetings: {
            hello: 'Bonjour',
          },
        },
      },
    }

    const extensionLocale = resolveDevExtensionLocale(localization, {user: userLocale})

    expect(extensionLocale).toBe(userLocale.split('-')[0])
  })

  test("returns the shop locale if it is provided as a supported locale and there isn't a match for the user locale", () => {
    const shopLocale = 'fr-FR'
    const userLocale = 'de-DE'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
          },
        },
        'fr-FR': {
          greetings: {
            hello: 'Bonjour',
          },
        },
      },
    }

    const extensionLocale = resolveDevExtensionLocale(localization, {user: userLocale, shop: shopLocale})

    expect(extensionLocale).toBe(shopLocale)
  })

  test("returns the non-regional shop locale if it is provided as a supported locale and there isn't a match for the user locale", async () => {
    const userLocale = 'ja-JP'
    const shopLocale = 'de-DE'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
          },
        },
        de: {
          greetings: {
            hello: 'Hallo',
          },
        },
      },
    }

    const extensionLocale = resolveDevExtensionLocale(localization, {user: userLocale, shop: shopLocale})

    expect(extensionLocale).toBe(shopLocale.split('-')[0])
  })

  test('returns the default translation locale when no full or partial match can be for neither user nor shop locale made', async () => {
    const userLocale = 'en-US'
    const shopLocale = 'ja'
    const defaultLocale = 'fi'

    const localization = {
      defaultLocale,
      lastUpdated: Date.now(),
      translations: {
        'en-CA': {
          greetings: {
            hello: 'Hello',
          },
        },
        de: {
          greetings: {
            hello: 'Hallo',
          },
        },
        fi: {
          greetings: {
            hello: 'Hei',
          },
        },
      },
    }

    const extensionLocale = resolveDevExtensionLocale(localization, {user: userLocale, shop: shopLocale})

    expect(extensionLocale).toBe(defaultLocale)
  })
})

describe('flattenDevExtensionTranslations()', () => {
  test('returns flattened translation keys using a single locale', () => {
    const resolvedLocale = 'en'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
          },
        },
      },
    }

    const flattenedTranslations = flattenDevExtensionTranslations(localization, resolvedLocale)

    expect(flattenedTranslations).toStrictEqual({
      'greetings.hello': 'Hello',
    })
  })

  test('returns flattened and merged translations with fallbacks for missing keys from the default locale', () => {
    const resolvedLocale = 'en-GB'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
            goodbye: 'Goodbye',
          },
        },
        'en-GB': {
          greetings: {
            hello: 'Hello, UK',
          },
        },
        fr: {
          greetings: {
            hello: 'Bonjour',
          },
        },
      },
    }

    const flattenedTranslations = flattenDevExtensionTranslations(localization, resolvedLocale)

    expect(flattenedTranslations).toStrictEqual({
      'greetings.hello': 'Hello, UK',
      'greetings.goodbye': 'Goodbye',
    })
  })

  test('returns flattened and merged translations based on exact match for locale translation', () => {
    const resolvedLocale = 'fr-CA'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
            goodbye: 'Goodbye',
          },
        },
        fr: {
          greetings: {
            hello: 'Bonjour',
            goodbye: 'Au revoir',
          },
        },
        'fr-CA': {
          greetings: {
            hello: 'Bonjour, Canada',
            goodbye: 'Au revoir, Canada',
          },
        },
      },
    }

    const flattenedTranslations = flattenDevExtensionTranslations(localization, resolvedLocale)

    expect(flattenedTranslations).toStrictEqual({
      'greetings.hello': 'Bonjour, Canada',
      'greetings.goodbye': 'Au revoir, Canada',
    })
  })

  test('returns flattened and merged translations based on non-regional match for locale translation', () => {
    const resolvedLocale = 'fr-CA'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
            goodbye: 'Goodbye',
            sorry: 'Sorry',
          },
        },
        fr: {
          greetings: {
            hello: 'Bonjour',
            goodbye: 'Au revoir',
            sorry: 'Désolé',
          },
        },
      },
    }

    const flattenedTranslations = flattenDevExtensionTranslations(localization, resolvedLocale)

    expect(flattenedTranslations).toStrictEqual({
      'greetings.hello': 'Bonjour',
      'greetings.goodbye': 'Au revoir',
      'greetings.sorry': 'Désolé',
    })
  })

  test('returns the flattened default locale where no locale match is possible (full or non-regional)', () => {
    const resolvedLocale = 'de'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
            goodbye: 'Goodbye',
            sorry: 'Sorry',
          },
        },
        fr: {
          greetings: {
            hello: 'Bonjour',
            goodbye: 'Au revoir',
            sorry: 'Désolé',
          },
        },
        'de-DE': {
          greetings: {
            hello: 'Hallo',
            goodbye: 'Auf Wiedersehen',
            sorry: ' Entschuldigung',
          },
        },
      },
    }

    const flattenedTranslations = flattenDevExtensionTranslations(localization, resolvedLocale)

    expect(flattenedTranslations).toStrictEqual({
      'greetings.hello': 'Hello',
      'greetings.goodbye': 'Goodbye',
      'greetings.sorry': 'Sorry',
    })
  })

  test('returns flattened translations with pluralizations', () => {
    const resolvedLocale = 'en'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          pluralExample: {
            one: 'You have {{count}} apple',
            other: 'You have {{count}} apples',
          },
          example: {
            of: {
              nestedTranslation: 'This is a nested translation only in the default locale',
              anotherNestedTranslation: 'This is another nested translation defined in the default locale',
            },
          },
        },
      },
    }

    const flattenedTranslations = flattenDevExtensionTranslations(localization, resolvedLocale)

    expect(flattenedTranslations).toStrictEqual({
      'pluralExample.one': 'You have {{count}} apple',
      'pluralExample.other': 'You have {{count}} apples',
      'example.of.nestedTranslation': 'This is a nested translation only in the default locale',
      'example.of.anotherNestedTranslation': 'This is another nested translation defined in the default locale',
    })
  })
})

describe('getFlattenedLocalization()', () => {
  test('returns flattened translations string and resolved extension locale when locales options are provided', () => {
    const userLocale = 'en'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
          },
        },
      },
    }

    const flattenedLocalization = getFlattenedLocalization(localization, {user: userLocale})

    expect(flattenedLocalization).toStrictEqual({
      extensionLocale: userLocale,
      translations: '{"greetings.hello":"Hello"}',
      lastUpdated: localization.lastUpdated,
    })
  })

  test('return undefined when locales options are not provided', () => {
    const userLocale = 'en'

    const localization = {
      defaultLocale: 'en',
      lastUpdated: Date.now(),
      translations: {
        en: {
          greetings: {
            hello: 'Hello',
          },
        },
      },
    }

    const flattenedLocalization = getFlattenedLocalization(localization)

    expect(flattenedLocalization).toBeUndefined()
  })

  test('return undefined when localization is null', () => {
    const userLocale = 'en'
    const flattenedLocalization = getFlattenedLocalization(null, {user: userLocale})

    expect(flattenedLocalization).toBeUndefined()
  })

  test('return flattened localization if localization is already flattened', () => {
    const userLocale = 'en'

    const localization = {
      extensionLocale: userLocale,
      lastUpdated: Date.now(),
      translations: '{"greetings.hello":"Hello"}',
    }

    const flattenedLocalization = getFlattenedLocalization(localization, {user: userLocale})

    expect(flattenedLocalization).toStrictEqual(localization)
  })
})
