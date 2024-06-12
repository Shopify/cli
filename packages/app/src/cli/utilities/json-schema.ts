import {FlattenedRemoteSpecification} from '../api/graphql/extension_specifications.js'
import {BaseConfigType} from '../models/extensions/schemas.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {ParseConfigurationResult} from '@shopify/cli-kit/node/schema'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'

/**
 * Factory returning a function that can parse a configuration object against a locally defined zod schema, and a remotely defined JSON schema based contract
 * @param merged - The merged specification object from the remote and local sources
 * @returns A function that can parse a configuration object
 */
export function unifiedConfigurationParserFactory(
  merged: RemoteAwareExtensionSpecification & FlattenedRemoteSpecification,
) {
  if (merged.contract === undefined) {
    return merged.parseConfigurationObject
  }
  const contract = JSON.parse(merged.contract)

  const parseConfigurationObject = (config: object): ParseConfigurationResult<BaseConfigType> => {
    // First we parse with zod. This may also change the format of the data.
    const zodParse = merged.parseConfigurationObject(config)

    // Then, even if this failed, we try to validate against the contract.
    const zodValidatedData = zodParse.state === 'ok' ? zodParse.data : undefined
    const subjectForAjv = zodValidatedData ?? config
    const jsonSchemaParse = jsonSchemaValidate(subjectForAjv, contract)

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
      data: zodValidatedData as BaseConfigType,
      errors: undefined,
    }
  }
  return parseConfigurationObject
}
