import {ExtensionSpecification} from '../../extensions/specification.js'
import {HandleInvalidAdditionalProperties, jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
import {SchemaObject} from 'ajv'

interface ValidationError {
  path: (string | number)[]
  message: string
}

/**
 * Validate a config slice against a spec's Zod schema and JSON Schema contract.
 * Returns errors only — no data shaping, no stripping.
 *
 * For locally-defined specs: Zod validates structure, AJV validates contract (if exists).
 * For contract-based specs (zod.any()): Zod is a no-op, AJV does all validation.
 *
 * @param slice - The spec's portion of the app config (from sliceConfigForSpec)
 * @param spec - The extension specification to validate against
 * @returns Deduplicated array of validation errors (empty = valid)
 */
export function validateSpecConfig(slice: object, spec: ExtensionSpecification): ValidationError[] {
  const errors: ValidationError[] = []

  // Zod validation (no-op for contract-based specs with zod.any())
  const zodResult = spec.schema.safeParse(slice)
  if (!zodResult.success) {
    errors.push(...zodResult.error.issues.map((issue) => ({path: issue.path, message: issue.message})))
  }

  // AJV validation in 'fail' mode (if contract exists)
  // contractSchema is set during mergeLocalAndRemoteSpecs for specs with a remote contract
  const contractSchema = (spec as ExtensionSpecificationWithContract).contractSchema
  if (contractSchema) {
    const ajvResult = jsonSchemaValidate(slice, contractSchema, 'fail' as HandleInvalidAdditionalProperties)
    if (ajvResult.state === 'error') {
      errors.push(...ajvResult.errors)
    }
  }

  // Deduplicate errors (same logic as unifiedConfigurationParserFactory)
  const seen = new Set<string>()
  return errors.filter((error) => {
    const key = JSON.stringify({path: error.path, message: error.message})
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Extended spec type that may have a pre-normalized contract schema
interface ExtensionSpecificationWithContract extends ExtensionSpecification {
  contractSchema?: SchemaObject
}
