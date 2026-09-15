import {prependApplicationUrl} from './url_prepender.js'
import {URL_CONTROL_CHARACTERS, isHttpsUrl} from '../../../app/validation/common.js'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Resolves a single app relative URL field against the app's URL, rejecting anything that cannot become a valid
 * absolute HTTPS URL. `label` and `fieldName` only appear in the error messages, so callers can name the field the
 * same way it is spelled in the TOML.
 */
export const resolveAppRelativeUrl = (
  label: string,
  fieldName: string,
  url: string,
  appUrl: string | undefined,
): string => {
  if (url.startsWith('//')) {
    throw new AbortError(
      `${label} ${fieldName} is invalid: a URL relative to the app URL must start with a single slash.`,
    )
  }

  if (URL_CONTROL_CHARACTERS.test(url)) {
    throw new AbortError(
      `${label} ${fieldName} is invalid: a URL must not contain control characters such as newlines or tabs.`,
    )
  }

  const resolvedUrl = prependApplicationUrl(url, appUrl)
  if (resolvedUrl.startsWith('/')) {
    throw new AbortError(
      `${label} ${fieldName} is a relative URL, but no application_url is configured. ` +
        'Set application_url in your app configuration or use an absolute HTTPS URL.',
    )
  }

  if (!isHttpsUrl(resolvedUrl)) {
    throw new AbortError(
      `${label} ${fieldName} must resolve to an HTTPS URL. ` +
        'Set application_url to an HTTPS URL or use an absolute HTTPS URL.',
    )
  }

  return resolvedUrl
}

/**
 * Resolves declared top-level URL fields in place. Absolute URLs, missing fields, and non-string values are left
 * untouched; configuration validation remains the specification's responsibility.
 */
export function patchAppRelativeUrls(
  label: string,
  fields: ReadonlyArray<string>,
  config: object,
  appUrl: string | undefined,
): void {
  const indexableConfig = config as {[key: string]: unknown}
  for (const field of fields) {
    const value = indexableConfig[field]
    if (typeof value === 'string' && value.startsWith('/')) {
      indexableConfig[field] = resolveAppRelativeUrl(label, field, value, appUrl)
    }
  }
}
