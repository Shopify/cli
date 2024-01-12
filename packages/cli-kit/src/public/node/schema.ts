import {ZodObject, ZodOptional, ZodTypeAny, z} from 'zod'

export {z as zod} from 'zod'

/**
 * Returns a new schema that is the same as the input schema, but with all nested schemas set to strict.
 *
 * @param schema - The schema to make strict.
 * @returns The result strict schema.
 */
export function deepStrict(schema: ZodTypeAny): ZodTypeAny {
  if (schema instanceof ZodObject) {
    const shape = schema.shape
    const strictShape = Object.fromEntries(
      Object.entries(shape).map(([key, value]) => [key, deepStrict(value as ZodTypeAny)]),
    )
    return z.object(strictShape).strict()
  } else if (schema instanceof ZodOptional) {
    return deepStrict(schema._def.innerType).optional()
  } else {
    return schema
  }
}
