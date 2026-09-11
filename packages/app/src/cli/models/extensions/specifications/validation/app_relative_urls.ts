import {prependApplicationUrl} from './url_prepender.js'
import {URL_CONTROL_CHARACTERS, isHttpsUrl} from '../../../app/validation/common.js'
import {AbortError} from '@shopify/cli-kit/node/error'

interface RelativeUrlModule {
  label: string
  fields: string[]
}

/**
 * Contract based modules have no local specification, so their configuration is sent to the server exactly as it
 * appears in the TOML. These fields are the exception: a relative value (a path starting with a single slash) is
 * resolved against the app's URL, the same way `flow_action`'s URL fields are resolved by its own specification.
 *
 * To give another contract based module the same treatment, add it here. The server side contract has to accept the
 * relative form as well, otherwise the configuration is rejected when it is parsed, before any of this runs.
 */
const MODULES_WITH_RELATIVE_URLS: {[identifier: string]: RelativeUrlModule} = {
  flow_trigger_lifecycle_callback: {label: 'Flow trigger lifecycle callback', fields: ['url']},
}

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
 * Resolves in place every app relative URL field of a contract based module's configuration. Absolute URLs, and
 * modules with no relative URL fields, are left untouched.
 */
export function patchAppRelativeUrls(identifier: string, config: object, appUrl: string | undefined): void {
  const module = MODULES_WITH_RELATIVE_URLS[identifier]
  if (!module) return

  const indexableConfig = config as {[key: string]: unknown}
  for (const field of module.fields) {
    const value = indexableConfig[field]
    if (typeof value === 'string' && value.startsWith('/')) {
      indexableConfig[field] = resolveAppRelativeUrl(module.label, field, value, appUrl)
    }
  }
}
