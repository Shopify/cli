import {PushConfig, PushConfigSchema} from '../../../api/graphql/push_config.js'
import {AppInterface} from '../../../models/app/app.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {OutputMessage} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'

export interface Options {
  app: AppInterface
}

export async function pushConfig(options: Options) {
  const token = await ensureAuthenticatedPartners()
  const mutation = PushConfig

  const {configuration} = options.app
  const configFileName = basename(options.app.configurationPath)

  if (!configuration.client_id) {
    abort(`${configFileName} does not contain a client_id.`)
  }
  const initialVariables = {
    apiKey: configuration.client_id,
    title: configuration.name,
    applicationUrl: configuration.application_url,
    redirectUrlAllowlist: configuration.redirect_url_allowlist,
    requestedAccessScopes: configuration.requested_access_scopes,
  }

  const variables = removeFalsyEntries(initialVariables)

  const result: PushConfigSchema = await partnersRequest(mutation, token, variables)

  if (result.appUpdate.userErrors.length > 0) {
    const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
    abort(errors)
  }

  renderSuccess({
    headline: `Updated app configuration for ${configuration.name}`,
    body: [`${configFileName} configuration is now live on Shopify.`],
  })
}

export const abort = (errorMessage: OutputMessage) => {
  throw new AbortError(errorMessage)
}

// this is placeholder for a more robust validation/clearing layer
export const removeFalsyEntries = (obj: {[key: string]: string | string[] | undefined}) => {
  return Object.keys(obj).reduce((acc: {[key: string]: string | string[] | undefined}, key) => {
    if (obj[key]) {
      acc[key] = obj[key]
    }
    return acc
  }, {})
}
