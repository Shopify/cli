import {FlattenedRemoteSpecification} from '../api/graphql/extension_specifications.js'
import {BaseConfigType} from '../models/extensions/schemas.js'
import {configWithoutFirstClassFields, RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {ParseConfigurationResult} from '@shopify/cli-kit/node/schema'
import {
  HandleInvalidAdditionalProperties,
  jsonSchemaValidate,
  normaliseJsonSchema,
} from '@shopify/cli-kit/node/json-schema'
import {isEmpty} from '@shopify/cli-kit/common/object'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

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
  const extensionIdentifier = merged.identifier

  const parseConfigurationObject = (config: object): ParseConfigurationResult<BaseConfigType> => {
    const subjectForAjvWithoutFirstClassFields = configWithoutFirstClassFields(config as JsonMapType)
    const jsonSchemaParse = jsonSchemaValidate(
      subjectForAjvWithoutFirstClassFields,
      contract,
      handleInvalidAdditionalProperties,
      extensionIdentifier,
    )

    // Finally, we de-duplicate the error set from both validations -- identical messages for identical paths are removed
    let errors = jsonSchemaParse.errors ?? []
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
    if (jsonSchemaParse.state !== 'ok') {
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
