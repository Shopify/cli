import {ZodObject, ZodOptional, ZodTypeAny, z} from 'zod'

export {z as zod} from 'zod'

/**
 * Type alias for a zod object schema that produces a given shape once parsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodObjectOf<T> = ZodObject<any, any, any, T>

/**
 * Returns a new schema that is the same as the input schema, but with all nested schemas set to strict.
 *
 * @param schema - The schema to make strict.
 * @returns The result strict schema.
 */
export function deepStrict<T>(schema: T): T {
  if (schema instanceof ZodObject) {
    const shape = schema.shape
    const strictShape = Object.fromEntries(
      Object.entries(shape).map(([key, value]) => [key, deepStrict(value as ZodTypeAny)]),
    )
    return z.object(strictShape).strict() as T
  } else if (schema instanceof ZodOptional) {
    return deepStrict(schema._def.innerType).optional()
  } else {
    return schema
  }
}

/**
 * Returns a human-readable string of the list of zod errors.
 *
 * @param errors - The list of zod errors.
 * @returns The human-readable string.
 */
export function errorsToString(errors: z.ZodIssueBase[]): string {
  return errors
    .map((error) =>
      error.path
        .join('.')
        .concat(': ')
        .concat(error.message ?? 'Unknow error'),
    )
    .join('\n')
}

/**
 * A neutral type for the result of a parsing/validation operation.
 *
 * As some validation can happen via JSON Schema, we prefer to use a type that isn't wholly dependent on Zod (or
 * JSON Schema).
 */
export type ParseConfigurationResult<TConfiguration> =
  | {
      state: 'ok'
      data: TConfiguration
      errors: undefined
    }
  | {
      state: 'error'
      data: undefined
      errors: Pick<z.ZodIssueBase, 'path' | 'message'>[]
    }
