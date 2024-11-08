import {CurrentAppConfiguration} from '../../models/app/app.js'
import {reduceWebhooks} from '../../models/extensions/specifications/transform/app_config_webhook.js'
import {removeTrailingSlash} from '../../models/extensions/specifications/validation/common.js'
import {writeFileSync} from '@shopify/cli-kit/node/fs'
import {JsonMapType, encodeToml} from '@shopify/cli-kit/node/toml'
import {zod} from '@shopify/cli-kit/node/schema'
import {outputDebug} from '@shopify/cli-kit/node/output'

// toml does not support comments and there aren't currently any good/maintained libs for this,
// so for now, we manually add comments
export async function writeAppConfigurationFile(configuration: CurrentAppConfiguration, schema: zod.ZodTypeAny) {
  outputDebug(`Writing app configuration to ${configuration.path}`)

  // we need to condense the compliance and non-compliance webhooks again
  // so compliance topics and topics with the same uri are under
  // the same [[webhooks.subscriptions]] in the TOML
  const condensedWebhooksAppConfiguration = condenseComplianceAndNonComplianceWebhooks(configuration)

  const sorted = rewriteConfiguration(schema, condensedWebhooksAppConfiguration) as {
    [key: string]: string | boolean | object
  }

  const encodedString = encodeToml(sorted as JsonMapType)

  const file = addDefaultCommentsToToml(encodedString)

  writeFileSync(configuration.path, file)
}

export const rewriteConfiguration = <T extends zod.ZodTypeAny>(schema: T, config: unknown): unknown => {
  // Remove app_id if organization_id is not present.
  // This will become unnecessary when we remove app_id from App Management apps.
  let configCopy = config
  if (typeof config === 'object' && config !== null && config !== undefined) {
    if ('app_id' in config && !('organization_id' in config)) {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const {app_id, ...rest} = config
      configCopy = rest
    }
  }

  if (schema === null || schema === undefined) return null
  if (schema instanceof zod.ZodNullable || schema instanceof zod.ZodOptional)
    return rewriteConfiguration(schema.unwrap(), configCopy)
  if (schema instanceof zod.ZodArray) {
    return (configCopy as unknown[]).map((item) => rewriteConfiguration(schema.element, item))
  }
  if (schema instanceof zod.ZodEffects) {
    return rewriteConfiguration(schema._def.schema, configCopy)
  }
  if (schema instanceof zod.ZodObject) {
    const entries = Object.entries(schema.shape)
    const confObj = configCopy as {[key: string]: unknown}
    let result: {[key: string]: unknown} = {}
    entries.forEach(([key, subSchema]) => {
      if (confObj !== undefined && confObj[key] !== undefined) {
        let value = rewriteConfiguration(subSchema as T, confObj[key])
        if (!(value instanceof Array) && value instanceof Object && Object.keys(value as object).length === 0) {
          value = undefined
        }
        result = {...result, [key]: value}
      }
    })

    // if dynamic config was enabled, its possible to have more keys in the file than the schema
    const blockedKeys = ['path', 'scopes']

    Object.entries(confObj)
      .filter(([key]) => !blockedKeys.includes(key))
      .sort(([key, _value]) => key.localeCompare(key))
      .forEach(([key, value]) => {
        if (!entries.map(([key]) => key).includes(key)) {
          result = {...result, [key]: value}
        }
      })

    return result
  }
  return config
}

export function addDefaultCommentsToToml(fileString: string) {
  const appTomlInitialComment = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration\n`
  const appTomlScopesComment = `\n# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes`

  const fileSplit = fileString.split(/(\r\n|\r|\n)/)
  fileSplit.unshift('\n')
  fileSplit.unshift(appTomlInitialComment)

  fileSplit.forEach((line, index) => {
    if (line === '[access_scopes]') {
      fileSplit.splice(index + 1, 0, appTomlScopesComment)
    }
  })

  return fileSplit.join('')
}

/**
 * When we merge webhooks, we have the privacy and non-privacy compliance subscriptions
 * separated for matching remote/local config purposes,
 * but when we link we want to condense all webhooks together
 * so we have to do an additional reduce here
 */
function condenseComplianceAndNonComplianceWebhooks(config: CurrentAppConfiguration) {
  const webhooksConfig = config.webhooks
  if (webhooksConfig?.subscriptions?.length) {
    const appUrl = removeTrailingSlash(config?.application_url) as string | undefined
    webhooksConfig.subscriptions = reduceWebhooks(webhooksConfig.subscriptions)
    webhooksConfig.subscriptions = webhooksConfig.subscriptions.map(({uri, ...subscription}) => ({
      uri: appUrl && uri.includes(appUrl) ? uri.replace(appUrl, '') : uri,
      ...subscription,
    }))
  }

  return config
}
