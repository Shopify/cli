import {AppConfiguration, AppSchema} from '../../models/app/app.js'
import {writeFileSync} from '@shopify/cli-kit/node/fs'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {zod} from '@shopify/cli-kit/node/schema'

// toml does not support comments and there aren't currently any good/maintained libs for this,
// so for now, we manually add comments
export async function writeAppConfigurationFile(configuration: AppConfiguration, schema: zod.ZodTypeAny = AppSchema) {
  const sorted = rewriteConfiguration(schema, configuration) as {[key: string]: string | boolean | object}
  const file = JSON.stringify(sorted as JsonMapType, null, 2)

  writeFileSync(configuration.path, file)
}

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
        if (value instanceof Object && Object.keys(value as object).length === 0) {
          value = undefined
        }
        result = {...result, [key]: value}
      }
    })
    return result
  }
  return config
}
