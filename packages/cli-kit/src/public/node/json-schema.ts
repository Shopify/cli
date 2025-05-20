/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {ParseConfigurationResult} from './schema.js'
import {randomUUID} from './crypto.js'
import {getPathValue} from '../common/object.js'
import {capitalize} from '../common/string.js'
import {Ajv, ErrorObject, SchemaObject, ValidateFunction} from 'ajv'
import $RefParser from '@apidevtools/json-schema-ref-parser'
import cloneDeep from 'lodash/cloneDeep.js'

export type HandleInvalidAdditionalProperties = 'strip' | 'fail'

type AjvError = ErrorObject<string, {[key: string]: unknown}>

/**
 * Normalises a JSON Schema by standardising it's internal implementation.
 *
 * We prefer to not use $ref elements in our schemas, so we inline them; it's easier then to process errors.
 *
 * @param schema - The JSON schema (as a string) to normalise.
 * @returns The normalised JSON schema.
 */
export async function normaliseJsonSchema(schema: string): Promise<SchemaObject> {
  // we want to modify the schema, removing any $ref elements and inlining with their source
  const parsedSchema = JSON.parse(schema)
  await $RefParser.dereference(parsedSchema, {resolve: {external: false}})
  return parsedSchema
}

function createAjvValidator(
  handleInvalidAdditionalProperties: HandleInvalidAdditionalProperties,
  schema: SchemaObject,
) {
  // allowUnionTypes: Allows types like `type: ["string", "number"]`
  // removeAdditional: Removes extraneous properties from the subject if `additionalProperties: false` is specified
  let removeAdditional
  switch (handleInvalidAdditionalProperties) {
    case 'strip':
      removeAdditional = true
      break
    case 'fail':
      removeAdditional = undefined
      break
  }
  const ajv = new Ajv({allowUnionTypes: true, removeAdditional, allErrors: true, verbose: true})
  ajv.addKeyword('x-taplo')

  const validator = ajv.compile(schema)

  return validator
}

const validatorsCache = new Map<string, ValidateFunction>()

/**
 * Given a subject object and a JSON schema contract, validate the subject against the contract.
 *
 * Errors are returned in a zod-like format, and processed to better handle unions.
 *
 * @param subject - The object to validate.
 * @param schema - The JSON schema to validate against.
 * @param handleInvalidAdditionalProperties - Whether to strip or fail on invalid additional properties.
 * @param identifier - The identifier of the schema being validated, used to cache the validator.
 * @returns The result of the validation. If the state is 'error', the errors will be in a zod-like format.
 */
export function jsonSchemaValidate(
  subject: object,
  schema: SchemaObject,
  handleInvalidAdditionalProperties: HandleInvalidAdditionalProperties,
  identifier?: string,
): ParseConfigurationResult<unknown> & {rawErrors?: AjvError[]} {
  const subjectToModify = cloneDeep(subject)

  const cacheKey = identifier ?? randomUUID()

  const validator = validatorsCache.get(cacheKey) ?? createAjvValidator(handleInvalidAdditionalProperties, schema)
  validatorsCache.set(cacheKey, validator)

  validator(subjectToModify)

  // Errors from the contract are post-processed to be more zod-like and to deal with unions better
  let jsonSchemaErrors
  if (validator.errors && validator.errors.length > 0) {
    jsonSchemaErrors = convertJsonSchemaErrors(validator.errors, subjectToModify, schema)
    return {
      state: 'error',
      data: undefined,
      errors: jsonSchemaErrors,
      rawErrors: validator.errors,
    }
  }
  return {
    state: 'ok',
    data: subjectToModify,
    errors: undefined,
    rawErrors: undefined,
  }
}

/**
 * Converts errors from Ajv into a zod-like format.
 *
 * @param rawErrors - JSON Schema errors taken directly from Ajv.
 * @param subject - The object being validated.
 * @param schema - The JSON schema to validated against.
 * @returns The errors in a zod-like format.
 */
function convertJsonSchemaErrors(rawErrors: AjvError[], subject: object, schema: SchemaObject) {
  // This reduces the number of errors by simplifying errors coming from different branches of a union
  const errors = simplifyUnionErrors(rawErrors, subject, schema)

  // Now we can remap errors to be more zod-like
  return errors.map((error) => {
    const path: string[] = error.instancePath.split('/').slice(1)
    if (error.params.missingProperty) {
      const missingProperty = error.params.missingProperty as string
      return {path: [...path, missingProperty], message: 'Required'}
    }

    if (error.params.type) {
      const expectedType = Array.isArray(error.params.type)
        ? error.params.type.join(', ')
        : (error.params.type as string)
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

    if (error.params.additionalProperty) {
      const supportedProperties = Object.keys(error.parentSchema?.properties ?? {})

      // if a property was already set, remove it from here
      const alreadySetProperties = Object.keys(error.data ?? {})
      const remainingProperties = supportedProperties.filter((property) => !alreadySetProperties.includes(property))

      if (remainingProperties.length > 0) {
        return {
          path: [...path, error.params.additionalProperty as string],
          message: `No additional properties allowed. You can set ${remainingProperties.sort().join(', ')}.`,
        }
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
 * one branch is less wrong than the others -- e.g. It had a valid `type`, but problems elsewhere -- then we keep the
 * errors for that branch.
 *
 * This is complex but in practise gives much more actionable errors.
 *
 * @param rawErrors - JSON Schema errors taken directly from Ajv.
 * @param subject - The object being validated.
 * @param schema - The JSON schema to validated against.
 * @returns A simplified list of errors.
 */
function simplifyUnionErrors(rawErrors: AjvError[], subject: object, schema: SchemaObject): AjvError[] {
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
    const unionSchemas = getPathValue<SchemaObject[]>(schema, dottedSchemaPath)
    // and the slice of the subject that caused the issue
    const subjectValue = getPathValue(subject, unionError.instancePath.split('/').slice(1).join('.'))

    if (unionSchemas !== undefined && subjectValue !== undefined) {
      // we know that none of the union schemas are correct, but for each of them we can measure how wrong they are
      const correctValuesAndErrors = unionSchemas
        .map((candidateSchemaFromUnion: SchemaObject) => {
          const candidateSchemaValidator = createAjvValidator('fail', candidateSchemaFromUnion)
          candidateSchemaValidator(subjectValue)

          let score = 0
          if (candidateSchemaFromUnion.type === 'object') {
            // provided the schema is an object, we can measure how many properties are good
            const candidatesObjectProperties = Object.keys(candidateSchemaFromUnion.properties)
            score = candidatesObjectProperties.reduce((acc, propertyName) => {
              const subSchema = candidateSchemaFromUnion.properties[propertyName] as SchemaObject
              const subjectValueSlice = getPathValue(subjectValue, propertyName)

              const subValidator = createAjvValidator('fail', subSchema)
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
    }
    errors = [...unrelatedErrors, ...simplifiedUnionRelatedErrors]

    resolvedUnionErrors.add(unionError.instancePath)
  }
  return errors
}
