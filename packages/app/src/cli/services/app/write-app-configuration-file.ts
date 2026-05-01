import {CurrentAppConfiguration} from '../../models/app/app.js'
import {reduceWebhooks} from '../../models/extensions/specifications/transform/app_config_webhook.js'
import {removeTrailingSlash} from '../../models/extensions/specifications/validation/common.js'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {zod} from '@shopify/cli-kit/node/schema'
import {outputDebug} from '@shopify/cli-kit/node/output'

export async function writeAppConfigurationFile(configuration: CurrentAppConfiguration, configPath: string) {
  outputDebug(`Writing app configuration to ${configPath}`)

  // we need to condense the compliance and non-compliance webhooks again
  // so compliance topics and topics with the same uri are under
  // the same [[webhooks.subscriptions]] in the TOML
  const condensed = condenseComplianceAndNonComplianceWebhooks(structuredClone(configuration))
  const cleaned = stripEmptyObjects(condensed) as JsonMapType

  const file = new TomlFile(configPath, {})
  await file.replace(cleaned)
  await file.transformRaw(addDefaultCommentsToToml)
}

/**
 * Recursively removes keys whose values are empty objects `{}`.
 * Preserves empty arrays, null, undefined, and all other values.
 */
export function stripEmptyObjects(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(stripEmptyObjects)
  if (typeof obj === 'object') {
    const result: {[key: string]: unknown} = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const stripped = stripEmptyObjects(value)
      if (
        typeof stripped === 'object' &&
        stripped !== null &&
        !Array.isArray(stripped) &&
        Object.keys(stripped).length === 0
      ) {
        continue
      }
      result[key] = stripped
    }
    return result
  }
  return obj
}

/**
 * Rewrite a configuration object to match the structure of a Zod schema.
 *
 * Used by breakdown-extensions.ts to normalize configs before diffing.
 * Not used by writeAppConfigurationFile — that function uses stripEmptyObjects instead.
 */
export const rewriteConfiguration = <T extends zod.ZodTypeAny>(schema: T, config: unknown): unknown => {
  if (schema === null || schema === undefined) return null
  if (schema instanceof zod.ZodNullable || schema instanceof zod.ZodOptional)
    return rewriteConfiguration(schema.unwrap(), config)
  if (schema instanceof zod.ZodArray) {
    return (config as unknown[]).map((item) => rewriteConfiguration(schema.element, item))
  }
  if (schema instanceof zod.ZodEffects) {
    return rewriteConfiguration(schema._def.schema, config)
  }
  if (schema instanceof zod.ZodObject) {
    const entries = Object.entries(schema.shape)
    const confObj = config as {[key: string]: unknown}
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
    const blockedKeys = ['scopes']

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

function addDefaultCommentsToToml(fileString: string) {
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
  if (Array.isArray(webhooksConfig?.subscriptions) && webhooksConfig.subscriptions.length) {
    const appUrl = removeTrailingSlash(config?.application_url) as string | undefined
    webhooksConfig.subscriptions = reduceWebhooks(webhooksConfig.subscriptions)
    webhooksConfig.subscriptions = webhooksConfig.subscriptions.map(({uri, ...subscription}) => ({
      uri: appUrl && uri.includes(appUrl) ? uri.replace(appUrl, '') : uri,
      ...subscription,
    }))
  }

  return config
}
