import {prependApplicationUrl} from '../../models/extensions/specifications/validation/url_prepender.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {FlowActionUrlField} from './types.js'

/**
 * Resolves a Flow action URL by prepending the app URL to relative URLs and
 * ensuring the resolved URL is HTTPS.
 */
export const resolveFlowActionUrl = (fieldName: FlowActionUrlField, url: string, appUrl: string | undefined) => {
  const resolvedUrl = prependApplicationUrl(url, appUrl)
  if (resolvedUrl.startsWith('/')) {
    throw new AbortError(
      `Flow action ${fieldName} is a relative URL, but no application_url is configured. ` +
        'Set application_url in your app configuration or use an absolute HTTPS URL.',
    )
  }

  if (!resolvedUrl.startsWith('https://')) {
    throw new AbortError(
      `Flow action ${fieldName} must resolve to an HTTPS URL. ` +
        'Set application_url to an HTTPS URL or use an absolute HTTPS URL.',
    )
  }

  return resolvedUrl
}

/**
 * Loads the schema from the partner defined file.
 */
export const loadSchemaFromPath = async (extensionPath: string, patchPath: string | undefined) => {
  if (!patchPath) {
    return ''
  }

  const path = await glob(joinPath(extensionPath, patchPath))

  if (path.length > 1) {
    throw new Error('Multiple files found for schema path')
  } else if (path.length === 0) {
    throw new Error('No file found for schema path')
  }

  return readFile(path[0] as string)
}
