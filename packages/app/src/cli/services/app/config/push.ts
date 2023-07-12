import {PushConfig, PushConfigSchema, PushConfigVariables} from '../../../api/graphql/push_config.js'
import {ClearScopesSchema, clearRequestedScopes} from '../../../api/graphql/clear_requested_scopes.js'
import {App, GetConfig, GetConfigQuerySchema} from '../../../api/graphql/get_config.js'
import {
  AppConfiguration,
  CurrentAppConfiguration,
  isCurrentAppSchema,
  usesLegacyScopesBehavior,
  getAppScopesArray,
} from '../../../models/app/app.js'
import {DeleteAppProxySchema, deleteAppProxy} from '../../../api/graphql/app_proxy_delete.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {OutputMessage} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'

export interface Options {
  configuration: AppConfiguration
  configurationPath: string
}

export async function pushConfig({configuration, configurationPath}: Options) {
  if (isCurrentAppSchema(configuration)) {
    const token = await ensureAuthenticatedPartners()
    const configFileName = basename(configurationPath)

    const queryVariables = {apiKey: configuration.client_id}
    const queryResult: GetConfigQuerySchema = await partnersRequest(GetConfig, token, queryVariables)

    if (!queryResult.app) abort("Couldn't find app. Make sure you have a valid client ID.")

    const {app} = queryResult

    const variables = getMutationVars(app, configuration)

    const result: PushConfigSchema = await partnersRequest(PushConfig, token, variables)

    if (result.appUpdate.userErrors.length > 0) {
      const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
      abort(errors)
    }

    const shouldDeleteScopes =
      app.requestedAccessScopes &&
      (configuration.access_scopes?.scopes === undefined || usesLegacyScopesBehavior(configuration))

    if (shouldDeleteScopes) {
      const clearResult: ClearScopesSchema = await partnersRequest(clearRequestedScopes, token, {apiKey: app.apiKey})

      if (clearResult.appRequestedAccessScopesClear?.userErrors?.length > 0) {
        const errors = clearResult.appRequestedAccessScopesClear.userErrors.map((error) => error.message).join(', ')
        abort(errors)
      }
    }

    if (!configuration.app_proxy && app.appProxy) {
      const deleteResult: DeleteAppProxySchema = await partnersRequest(deleteAppProxy, token, {apiKey: app.apiKey})

      if (deleteResult?.userErrors?.length > 0) {
        const errors = deleteResult.userErrors.map((error) => error.message).join(', ')
        abort(errors)
      }
    }

    renderSuccess({
      headline: `Updated app configuration for ${configuration.name}`,
      body: [`${configFileName} configuration is now live on Shopify.`],
    })
  }
}

const getMutationVars = (app: App, configuration: CurrentAppConfiguration) => {
  const variables: PushConfigVariables = {
    apiKey: configuration.client_id,
    title: configuration.name,
    applicationUrl: configuration.application_url,
    contactEmail: configuration.api_contact_email,
    webhookApiVersion: configuration.webhooks?.api_version,
    redirectUrlAllowlist: configuration.auth?.redirect_urls ?? null,
    embedded: configuration.embedded ?? app.embedded,
    gdprWebhooks: {
      customerDeletionUrl: configuration.webhooks?.privacy_compliance?.customer_deletion_url ?? undefined,
      customerDataRequestUrl: configuration.webhooks?.privacy_compliance?.customer_data_request_url ?? undefined,
      shopDeletionUrl: configuration.webhooks?.privacy_compliance?.shop_deletion_url ?? undefined,
    },
    posEmbedded: configuration.pos?.embedded ?? false,
    preferencesUrl: configuration.app_preferences?.url ?? null,
  }

  if (!usesLegacyScopesBehavior(configuration) && configuration.access_scopes?.scopes !== undefined) {
    variables.requestedAccessScopes = getAppScopesArray(configuration)
  }

  if (configuration.app_proxy) {
    variables.appProxy = {
      proxySubPath: configuration.app_proxy.subpath,
      proxySubPathPrefix: configuration.app_proxy.prefix,
      proxyUrl: configuration.app_proxy.url,
    }
  }

  return variables
}

export const abort = (errorMessage: OutputMessage) => {
  throw new AbortError(errorMessage)
}
