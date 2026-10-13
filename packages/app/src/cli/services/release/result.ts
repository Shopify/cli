import {appReleaseJsonOutputSchema, type AppReleaseResult, type ReleaseResult} from './types.js'
import {AppVersionNotFoundError} from './errors.js'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, type TokenItem} from '@shopify/cli-kit/node/ui'
import type {OrganizationApp} from '../../models/organization.js'

export function renderAppReleaseError(error: unknown, format: 'json' | 'text'): never {
  if (format === 'text' && error instanceof AppVersionNotFoundError) {
    renderError({
      headline: "Version couldn't be released.",
      body: ['Version', {userInput: error.versionTag}, 'could not be found.'],
    })
    throw new AbortSilentError()
  }
  throw error
}

export function renderAppReleaseResult(
  result: ReleaseResult,
  remoteApp: OrganizationApp,
  format: 'json' | 'text',
): void {
  if (format === 'json') {
    if (result.status === 'failed') {
      const error = new AbortError("Version couldn't be released.")
      error.details = {userErrors: result.userErrors}
      throw error
    }
    outputResult(appReleaseJsonOutputSchema.encode(appReleaseResult(result, remoteApp)))
    if (result.status === 'cancelled') throw Object.assign(new AbortSilentError(), {oclif: {exit: 0}})
    return
  }

  if (result.status === 'cancelled') throw new AbortSilentError()
  const linkAndMessage: TokenItem = [
    {link: {label: result.version.versionTag ?? undefined, url: result.version.location}},
    result.version.message ? `\n${result.version.message}` : '',
  ]
  if (result.status === 'failed') {
    const errorMessages = result.userErrors.map((error) => error.message).join(', ')
    renderError({
      headline: "Version couldn't be released.",
      body: [...linkAndMessage, `${linkAndMessage.length > 0 ? '\n\n' : ''}${errorMessages}`],
    })
  } else {
    renderSuccess({headline: 'Version released to users.', body: linkAndMessage})
  }
}

function appReleaseResult(
  result: Exclude<ReleaseResult, {status: 'failed'}>,
  remoteApp: OrganizationApp,
): AppReleaseResult {
  if (result.status === 'cancelled') return {status: 'cancelled'}
  return {
    status: 'success',
    app: {name: remoteApp.title, clientId: remoteApp.apiKey},
    release: {
      version: {
        gid: result.version.uuid,
        name: result.version.versionTag === '' ? null : (result.version.versionTag ?? null),
        message: result.version.message === '' ? null : (result.version.message ?? null),
        url: result.version.location,
      },
    },
  }
}
