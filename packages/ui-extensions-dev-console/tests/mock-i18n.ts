import {CurrencyCode, I18n, I18nDetails, TranslationDictionary} from '@shopify/react-i18n'

export const defaultI18nDetails = {
  locale: 'en',
  currency: CurrencyCode.Usd,
  country: 'CA',
  timezone: 'UTC',
}

export function mockI18n(
  translations?: TranslationDictionary | TranslationDictionary[],
  details: Partial<I18nDetails> = {},
) {
  return new I18n(Array.isArray(translations) ? translations : (translations && [translations]) || [], {
    ...defaultI18nDetails,
    ...details,
  })
}
