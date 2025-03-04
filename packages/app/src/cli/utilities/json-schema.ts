import {FlattenedRemoteSpecification} from '../api/graphql/extension_specifications.js'
import {BaseConfigType} from '../models/extensions/schemas.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {ParseConfigurationResult} from '@shopify/cli-kit/node/schema'
import {
  HandleInvalidAdditionalProperties,
  jsonSchemaValidate,
  normaliseJsonSchema,
} from '@shopify/cli-kit/node/json-schema'
import {isEmpty} from '@shopify/cli-kit/common/object'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

/**
 * The base properties that are added to all JSON Schema contracts.
 *
 * These are not part of the specific extension contract, but are present in all module tomls (with 'uuid' uidStrategy).
 * They are optional properties, we just want to keep them if present in the config.
 *
 * They'll be stripped before deployment (see usage of `configWithoutFirstClassFields` in `specification.ts`)
 */
const JsonSchemaBaseProperties = {
  type: {type: 'string'},
  handle: {type: 'string'},
  uid: {type: 'string'},
  path: {type: 'string'},
  extensions: {},
}

/**
 * Factory returning a function that can parse a configuration object against a locally defined zod schema, and a remotely defined JSON schema based contract
 * @param merged - The merged specification object from the remote and local sources
 * @returns A function that can parse a configuration object
 */
export async function unifiedConfigurationParserFactory(
  merged: RemoteAwareExtensionSpecification & FlattenedRemoteSpecification,
  handleInvalidAdditionalProperties: HandleInvalidAdditionalProperties = 'strip',
) {
  const contractJsonSchema = merged.validationSchema?.jsonSchema
  if (contractJsonSchema === undefined || isEmpty(JSON.parse(contractJsonSchema))) {
    return merged.parseConfigurationObject
  }
  const contract = await normaliseJsonSchema(contractJsonSchema)
  contract.properties = {...JsonSchemaBaseProperties, ...contract.properties}
  const extensionIdentifier = merged.identifier

  const parseConfigurationObject = (config: object): ParseConfigurationResult<BaseConfigType> => {
    // First we parse with zod. This may also change the format of the data.
    const zodParse = merged.parseConfigurationObject(config)

    // Then, even if this failed, we try to validate against the contract.
    const zodValidatedData = zodParse.state === 'ok' ? zodParse.data : undefined
    const subjectForAjv = zodValidatedData ?? (config as JsonMapType)

    const jsonSchemaParse = jsonSchemaValidate(
      subjectForAjv,
      contract,
      handleInvalidAdditionalProperties,
      extensionIdentifier,
    )

    // Finally, we de-duplicate the error set from both validations -- identical messages for identical paths are removed
    let errors = zodParse.errors || []
    if (jsonSchemaParse.state === 'error') {
      errors = errors.concat(jsonSchemaParse.errors)
    }
    const errorSet = new Set()
    errors = errors.filter((error) => {
      const key = JSON.stringify({path: error.path, message: error.message})
      if (errorSet.has(key)) {
        return false
      }
      errorSet.add(key)
      return true
    })
    if (zodParse.state !== 'ok' || errors.length > 0) {
      return {
        state: 'error',
        data: undefined,
        errors,
      }
    }

    return {
      state: 'ok',
      data: jsonSchemaParse.data as BaseConfigType,
      errors: undefined,
    }
  }
  return parseConfigurationObject
}
