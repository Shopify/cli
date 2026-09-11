import {zodToJsonSchema} from 'zod-to-json-schema'
import type {ZodTypeAny, z} from 'zod'

interface JsonOutputSchemaDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
  readonly name: string
  readonly schema: TSchema
  readonly definitions: Readonly<Record<string, ZodTypeAny>>
}

export interface JsonOutputSchema<TSchema extends ZodTypeAny = ZodTypeAny> extends JsonOutputSchemaDefinition<TSchema> {
  readonly jsonSchema: ReturnType<typeof zodToJsonSchema>
  validate(value: unknown): z.output<TSchema>
  encode(value: z.input<TSchema>): string
}

export type InferJsonOutputSchema<TOutputSchema extends JsonOutputSchema> = z.output<TOutputSchema['schema']>

interface DefineJsonOutputSchemaOptions<TSchema extends ZodTypeAny> {
  name: string
  schema: TSchema
  definitions?: Readonly<Record<string, ZodTypeAny>>
}

/**
 * Defines the runtime validator, encoder, and JSON Schema for a command's JSON output.
 *
 * @param options - The root schema name, its Zod schema, and any named nested schemas.
 * @returns The complete JSON output contract.
 */
export function defineJsonOutputSchema<TSchema extends ZodTypeAny>(
  options: DefineJsonOutputSchemaOptions<TSchema>,
): JsonOutputSchema<TSchema> {
  return {
    name: options.name,
    schema: options.schema,
    definitions: options.definitions ?? {},
    jsonSchema: zodToJsonSchema(options.schema, {
      name: options.name,
      nameStrategy: 'title',
      ...(options.definitions ? {definitions: options.definitions} : {}),
      target: 'jsonSchema7',
    }),
    validate: (value) => options.schema.parse(value),
    encode: (value) => encodeJsonOutput(options.schema.parse(value)),
  }
}

function encodeJsonOutput(value: unknown): string {
  const encoded = JSON.stringify(value, null, 2)
  if (encoded === undefined) throw new TypeError('JSON output must be serializable.')
  return encoded
}
