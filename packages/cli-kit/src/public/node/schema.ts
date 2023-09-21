import {parseSchema} from 'json-schema-to-zod'
import * as z from 'zod'

export {z as zod} from 'zod'

/**
 * Convert JSON schema (draft 4+) objects into Zod schemas.
 *
 * @param schema - JSON schema object.
 * @returns Zod schema.
 */
export function jsonToZod(schema: object): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const zodSchema = parseSchema(schema)
  z.object({})
  // eslint-disable-next-line no-eval
  return eval(zodSchema)
}
