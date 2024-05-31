import {FlattenedRemoteSpecification} from '../api/graphql/extension_specifications.js'
import {BaseConfigType} from '../models/extensions/schemas.js'
import {ParseConfigurationResult, RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {Ajv, ErrorObject, SchemaObject} from 'ajv'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {capitalize} from '@shopify/cli-kit/common/string'

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
  const contract = JSON.parse(merged.contract) as SchemaObject

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

type AjvError = ErrorObject<string, {[key: string]: unknown}, unknown>

/**
 * Given a subject object and a JSON schema contract, validate the subject against the contract.
 *
 * Errors are returned in a zod-like format, and processed to better handle unions.
 */
export function jsonSchemaValidate(
  subject: object,
  contract: SchemaObject,
): ParseConfigurationResult<unknown> & {rawErrors?: AjvError[]} {
  const ajv = new Ajv()
  const validator = ajv.compile(contract)
  validator(subject)

  // Errors from the contract are post-processed to be more zod-like and to deal with unions better
  let jsonSchemaErrors
  if (validator.errors && validator.errors.length > 0) {
    jsonSchemaErrors = convertJsonSchemaErrors(validator.errors, subject, contract)
    return {
      state: 'error',
      data: undefined,
      errors: jsonSchemaErrors,
      rawErrors: validator.errors,
    }
  }
  return {
    state: 'ok',
    data: subject,
    errors: undefined,
    rawErrors: undefined,
  }
}

function convertJsonSchemaErrors(rawErrors: AjvError[], subject: object, contract: SchemaObject) {
  // This reduces the number of errors by simplifying errors coming from different branches of a union
  const errors = simplifyUnionErrors(rawErrors, subject, contract)

  // Now we can remap errors to be more zod-like
  return errors.map((error) => {
    const path: string[] = error.instancePath.split('/').slice(1)
    if (error.params.missingProperty) {
      const missingProperty = error.params.missingProperty as string
      return {path: [...path, missingProperty], message: 'Required'}
    }

    if (error.params.type) {
      const expectedType = error.params.type
      const actualType = getPathValue(subject, path.join('.'))
      return {path, message: `Expected ${expectedType}, received ${typeof actualType}`}
    }

    if (error.keyword === 'anyOf' || error.keyword === 'oneOf') {
      return {path, message: 'Invalid input'}
    }

    if (error.params.allowedValues) {
      const allowedValues = error.params.allowedValues as string[]
      const actualValue = getPathValue(subject, path.join('.'))
      return {
        path,
        message: `Invalid enum value. Expected ${allowedValues
          .map((value) => JSON.stringify(value))
          .join(' | ')}, received ${JSON.stringify(actualValue)}`.replace(/"/g, "'"),
      }
    }

    if (error.params.comparison) {
      const comparison = error.params.comparison as string
      const limit = error.params.limit
      const actualValue = getPathValue(subject, path.join('.'))

      let comparisonText = comparison
      switch (comparison) {
        case '<=':
          comparisonText = 'less than or equal to'
          break
        case '<':
          comparisonText = 'less than'
          break
        case '>=':
          comparisonText = 'greater than or equal to'
          break
        case '>':
          comparisonText = 'greater than'
          break
      }

      return {
        path,
        message: capitalize(`${typeof actualValue} must be ${comparisonText} ${limit}`),
      }
    }

    return {
      path,
      message: error.message,
    }
  })
}

/**
 * If a JSON schema specifies a union (anyOf, oneOf), and the subject doesn't meet any of the 'candidates' for the
 * union, then the error list received ends up being quite long: you get an error for the union property itself, and
 * then additional errors for each of the candidate branches.
 *
 * This function simplifies the error collection. By default it strips anything other than the union error itself.
 *
 * In some cases, it can be possible to identify what the intended branch of the union was -- for instance, maybe there
 * is a discriminating field like `type` that is unique between the branches. We inspect each candidate branch and if
 * one branch is less wrong than the others -- e.g. it had a valid `type`, but problems elsewhere -- then we keep the
 * errors for that branch.
 *
 * This is complex but in practise gives much more actionable errors.
 *
 */
function simplifyUnionErrors(rawErrors: AjvError[], subject: object, contract: SchemaObject): AjvError[] {
  const ajv = new Ajv()
  let errors = rawErrors

  const resolvedUnionErrors = new Set()
  while (true) {
    const unionError = errors.filter(
      (error) =>
        (error.keyword === 'oneOf' || error.keyword === 'anyOf') && !resolvedUnionErrors.has(error.instancePath),
    )[0]
    if (unionError === undefined) {
      break
    }
    // split errors into those sharing an instance path and those not
    const unrelatedErrors = errors.filter((error) => !error.instancePath.startsWith(unionError.instancePath))

    // we start by assuming only the union error itself is useful, and not the errors from the candidate schemas
    let simplifiedUnionRelatedErrors: AjvError[] = [unionError]

    // get the schema list from where the union issue occured
    const dottedSchemaPath = unionError.schemaPath.replace('#/', '').replace(/\//g, '.')
    const unionSchemas = getPathValue(contract, dottedSchemaPath) as SchemaObject[]

    // and the slice of the subject that caused the issue
    const subjectValue = getPathValue(subject, unionError.instancePath.split('/').slice(1).join('.')) as object

    // we know that none of the union schemas are correct, but for each of them we can measure how wrong they are
    const correctValuesAndErrors = unionSchemas
      .map((candidateSchemaFromUnion: SchemaObject) => {
        const candidateSchemaValidator = ajv.compile(candidateSchemaFromUnion)
        candidateSchemaValidator(subjectValue)

        let score = 0
        if (candidateSchemaFromUnion.type === 'object') {
          // provided the schema is an object, we can measure how many properties are good
          const candidatesObjectProperties = Object.keys(candidateSchemaFromUnion.properties)
          score = candidatesObjectProperties.reduce((acc, propertyName) => {
            const subSchema = candidateSchemaFromUnion.properties[propertyName] as SchemaObject
            const subjectValueSlice = getPathValue(subjectValue, propertyName)

            const subValidator = ajv.compile(subSchema)
            if (subValidator(subjectValueSlice)) {
              return acc + 1
            }
            return acc
          }, score)
        }

        return [score, candidateSchemaValidator.errors!] as const
      })
      .sort(([scoreA], [scoreB]) => scoreA - scoreB)

    if (correctValuesAndErrors.length >= 2) {
      const [bestScore, bestErrors] = correctValuesAndErrors[correctValuesAndErrors.length - 1]!
      const [penultimateScore] = correctValuesAndErrors[correctValuesAndErrors.length - 2]!

      if (bestScore !== penultimateScore) {
        // If there's a winner, show the errors for the best schema as they'll likely be actionable.
        // We got these through a nested schema, so we need to adjust the instance path
        simplifiedUnionRelatedErrors = [
          unionError,
          ...bestErrors.map((bestError) => ({
            ...bestError,
            instancePath: unionError.instancePath + bestError.instancePath,
          })),
        ]
      }
    }
    errors = [...unrelatedErrors, ...simplifiedUnionRelatedErrors]

    resolvedUnionErrors.add(unionError.instancePath)
  }
  return errors
}
