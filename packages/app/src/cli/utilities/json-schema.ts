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
import {outputWarn} from '@shopify/cli-kit/node/output'

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
  merged: RemoteAwareExtensionSpecification,
  validationSchema: {jsonSchema: string} | null | undefined,
  handleInvalidAdditionalProperties: HandleInvalidAdditionalProperties = 'strip',
) {
  const contractJsonSchema = validationSchema?.jsonSchema
  if (contractJsonSchema === undefined || isEmpty(JSON.parse(contractJsonSchema))) {
    return merged.parseConfigurationObject
  }
  const extensionIdentifier = merged.identifier

  let contract: Awaited<ReturnType<typeof normaliseJsonSchema>>
  try {
    contract = await normaliseJsonSchema(contractJsonSchema)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // A server-provided contract the CLI cannot use must not take down every
    // app command: fall back to local validation for this module only.
    warnAboutUnusableContract(extensionIdentifier, error)
    return merged.parseConfigurationObject
  }
  contract.properties = {...JsonSchemaBaseProperties, ...contract.properties}

  const parseConfigurationObject = (config: object): ParseConfigurationResult<BaseConfigType> => {
    // First we parse with zod. This may also change the format of the data.
    const zodParse = merged.parseConfigurationObject(config)

    // Then, even if this failed, we try to validate against the contract.
    const zodValidatedData = zodParse.state === 'ok' ? zodParse.data : undefined
    const subjectForAjv = zodValidatedData ?? (config as JsonMapType)

    let jsonSchemaParse
    try {
      jsonSchemaParse = jsonSchemaValidate(
        subjectForAjv,
        contract,
        handleInvalidAdditionalProperties,
        extensionIdentifier,
      )
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // Schema compilation happens on first use: an invalid contract (e.g. an
      // empty enum rendered by a server with no data for it) throws here.
      // Degrade to the zod result instead of crashing app loading.
      warnAboutUnusableContract(extensionIdentifier, error)
      return zodParse
    }

    // Finally, we de-duplicate the error set from both validations -- identical messages for identical paths are removed
    let errors = zodParse.errors ?? []
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

const warnedContractIdentifiers = new Set<string>()

/**
 * Warn (once per module identifier per process) that a server-provided
 * contract could not be used, without failing the command.
 *
 * @param extensionIdentifier - The module whose contract is unusable.
 * @param error - The underlying normalisation/compilation error.
 */
function warnAboutUnusableContract(extensionIdentifier: string, error: unknown) {
  if (warnedContractIdentifiers.has(extensionIdentifier)) return
  warnedContractIdentifiers.add(extensionIdentifier)
  const reason = error instanceof Error ? error.message : String(error)
  outputWarn(
    `The validation schema provided for "${extensionIdentifier}" couldn't be used and was ignored (${reason}). ` +
      `Validation for this configuration falls back to the CLI's local schema; the server still validates on deploy.`,
  )
}
