import {GdprWebhooks, PushConfig, PushConfigSchema, PushConfigVariables} from '../../../api/graphql/push_config.js'
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
import {confirmPushChanges} from '../../../prompts/config.js'
import {logMetadataForLoadedContext, renderCurrentlyUsedConfigInfo} from '../../context.js'
import {fetchOrgFromId} from '../../dev/fetch.js'
import {fetchPartnersSession} from '../../context/partner-account-info.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {loadApp} from '../../../models/app/loader.js'
import {WebhooksConfig} from '../../../models/extensions/specifications/types/app_config_webhook.js'
import {validateUrl} from '../../../models/app/validation/common.js'
import {ensureHttpsOnlyUrl} from '../../../models/extensions/specifications/validation/common.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {OutputMessage} from '@shopify/cli-kit/node/output'
import {basename, dirname} from '@shopify/cli-kit/node/path'
import {Config} from '@oclif/core'
import {zod} from '@shopify/cli-kit/node/schema'

const LegacyPushAppSchema = zod.object({
  name: zod.string().max(30),
  client_id: zod.string(),
  application_url: validateUrl(zod.string()),
  embedded: zod.boolean(),
  access_scopes: zod
    .object({
      scopes: zod.string().optional(),
      use_legacy_install_flow: zod.boolean().optional(),
    })
    .optional(),
  auth: zod
    .object({
      redirect_urls: zod.array(validateUrl(zod.string())),
    })
    .optional(),
  webhooks: zod.object({
    api_version: zod.string(),
    privacy_compliance: zod
      .object({
        customer_deletion_url: ensureHttpsOnlyUrl.optional(),
        customer_data_request_url: ensureHttpsOnlyUrl.optional(),
        shop_deletion_url: ensureHttpsOnlyUrl.optional(),
      })
      .optional(),
  }),
  app_proxy: zod
    .object({
      url: validateUrl(zod.string()),
      subpath: zod.string(),
      prefix: zod.string(),
    })
    .optional(),
  pos: zod
    .object({
      embedded: zod.boolean(),
    })
    .optional(),
  app_preferences: zod
    .object({
      url: validateUrl(zod.string().max(255)),
    })
    .optional(),
  build: zod
    .object({
      automatically_update_urls_on_dev: zod.boolean().optional(),
      dev_store_url: zod.string().optional(),
    })
    .optional(),
  extension_directories: zod.array(zod.string()).optional(),
  web_directories: zod.array(zod.string()).optional(),
})

export const DeprecatedPushMessage =
  'Command no longer supported.\n\nTo update your app configuration, upgrade Shopify CLI to the latest version and ' +
  'run the `app deploy` command. It will update all extensions and also app configuration, if you opt-in for your ' +
  'app. Review the documentation[1] for more details.\n\n' +
  '[1] https://shopify.dev/docs/apps/tools/cli/configuration#migrate-from-config-push'

export interface PushOptions {
  configuration: AppConfiguration
  force: boolean
  commandConfig: Config
}

const FIELD_NAMES: {[key: string]: string} = {
  title: 'name',
  api_key: 'client_id',
  redirect_url_whitelist: 'auth > redirect_urls',
  requested_access_scopes: 'access_scopes > scopes',
  webhook_api_version: 'webhooks > api_version',
  gdpr_webhooks: 'webhooks.privacy_compliance',
  'gdpr_webhooks,customer_deletion_url': 'webhooks.privacy_compliance > customer_deletion_url',
  'gdpr_webhooks,customer_data_request_url': 'webhooks.privacy_compliance > customer_data_request_url',
  'gdpr_webhooks,shop_deletion_url': 'webhooks.privacy_compliance > shop_deletion_url',
  proxy_sub_path: 'app_proxy > subpath',
  proxy_sub_path_prefix: 'app_proxy > prefix',
  proxy_url: 'app_proxy > url',
  preferences_url: 'app_preferences > url',
}

export async function pushConfig(options: PushOptions) {
  if (!isCurrentAppSchema(options.configuration)) return

  // Load local complete configuration
  const partnersSession = await fetchPartnersSession()
  const token = partnersSession.token
  const configFileName = isCurrentAppSchema(options.configuration) ? basename(options.configuration.path) : undefined
  const specifications = await fetchSpecifications({
    token,
    apiKey: options.configuration.client_id,
    config: options.commandConfig,
  })
  const localApp = await loadApp({
    directory: dirname(options.configuration.path),
    specifications,
    configName: configFileName,
  })
  const configuration = localApp.configuration as CurrentAppConfiguration

  // Fetch remote configuration
  const queryVariables = {apiKey: configuration.client_id}
  const queryResult: GetConfigQuerySchema = await partnersRequest(GetConfig, token, queryVariables)
  if (!queryResult.app) abort("Couldn't find app. Make sure you have a valid client ID.")
  const {app} = queryResult
  const useVersionedAppConfig = !app.disabledBetas.includes('versioned_app_config')
  if (useVersionedAppConfig) abort(DeprecatedPushMessage)

  const {businessName: org} = await fetchOrgFromId(app.organizationId, partnersSession)
  renderCurrentlyUsedConfigInfo({org, appName: app.title, configFile: configFileName})

  await logMetadataForLoadedContext(app)

  if (!(await confirmPushChanges(options.force, configuration, app, LegacyPushAppSchema))) return

  const variables = getMutationVars(app, configuration)

  const result: PushConfigSchema = await partnersRequest(PushConfig, token, variables)

  if (result.appUpdate.userErrors.length > 0) {
    const errors = result.appUpdate.userErrors
      .map((error) => {
        const [_, ...fieldPath] = error.field || []
        const mappedName = FIELD_NAMES[fieldPath.join(',')] || fieldPath.join(', ')
        const fieldName = mappedName ? `${mappedName}: ` : ''
        return `${fieldName}${error.message}`
      })
      .join('\n')
    abort(errors)
  }

  const shouldDeleteScopes =
    app.requestedAccessScopes &&
    (variables.requestedAccessScopes === undefined || usesLegacyScopesBehavior(configuration))

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
    headline: `Updated your app config for ${variables.title}`,
    body: [`Your ${configFileName} config is live for your app users.`],
  })
}

const getMutationVars = (app: App, configuration: CurrentAppConfiguration) => {
  const variables: PushConfigVariables = {
    apiKey: configuration.client_id,
    title: configuration.name,
    applicationUrl: configuration.application_url,
    webhookApiVersion: configuration.webhooks?.api_version ?? app.webhookApiVersion,
    redirectUrlAllowlist: configuration.auth?.redirect_urls ?? null,
    embedded: configuration.embedded ?? app.embedded,
    gdprWebhooks: mapPrivacyComplianceToGdprWebhooks(configuration.webhooks?.privacy_compliance),
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

function mapPrivacyComplianceToGdprWebhooks(privacyCompliance: WebhooksConfig['privacy_compliance']): GdprWebhooks {
  return {
    customerDeletionUrl: privacyCompliance?.customer_deletion_url,
    customerDataRequestUrl: privacyCompliance?.customer_data_request_url,
    shopDeletionUrl: privacyCompliance?.shop_deletion_url,
  }
}
