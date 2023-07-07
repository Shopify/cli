import {PushConfig, PushConfigSchema, PushConfigVariables} from '../../../api/graphql/push_config.js'
import {ClearScopesSchema, clearRequestedScopes} from '../../../api/graphql/clear_requested_scopes.js'
import {App, GetConfig, GetConfigQuerySchema} from '../../../api/graphql/get_config.js'
import {
  AppConfiguration,
  CurrentAppConfiguration,
  isCurrentAppSchema,
  usesLegacyScopesBehavior,
} from '../../../models/app/app.js'
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

    if (usesLegacyScopesBehavior(configuration)) {
      const clearResult: ClearScopesSchema = await partnersRequest(clearRequestedScopes, token, {apiKey: app.apiKey})

      if (clearResult.appRequestedAccessScopesClear?.userErrors?.length > 0) {
        const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
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
    // these values are mandatory, so we only read from the config file
    apiKey: configuration.client_id,
    title: configuration.name,
    applicationUrl: configuration.application_url!,
    contactEmail: configuration.api_contact_email!,
    webhookApiVersion: configuration.webhook_api_version!,
    // these values are optional, so we fall back to configured values
    redirectUrlAllowlist: configuration.auth?.redirect_urls ?? app.redirectUrlWhitelist,
    embedded: configuration.embedded ?? app.embedded,
    gdprWebhooks: {
      customerDeletionUrl: configuration.privacy_compliance_webhooks?.customer_deletion_url ?? undefined,
      customerDataRequestUrl: configuration.privacy_compliance_webhooks?.customer_data_request_url ?? undefined,
      shopDeletionUrl: configuration.privacy_compliance_webhooks?.shop_deletion_url ?? undefined,
    },
    posEmbedded: configuration.pos?.embedded ?? app.posEmbedded,
    preferencesUrl: configuration.app_preferences?.url ?? app.preferencesUrl,
  }

  if (!usesLegacyScopesBehavior(configuration)) {
    variables.requestedAccessScopes = configuration.scopes?.length ? configuration.scopes.split(',') : []
  }

  if (configuration.proxy) {
    variables.appProxy = {
      proxySubPath: configuration.proxy.subpath,
      proxySubPathPrefix: configuration.proxy.prefix,
      proxyUrl: configuration.proxy.url,
    }
  }

  return variables
}

export const abort = (errorMessage: OutputMessage) => {
  throw new AbortError(errorMessage)
}
