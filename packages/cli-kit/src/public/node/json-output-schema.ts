import {
  ZodArray,
  ZodBoolean,
  ZodEnum,
  ZodLiteral,
  ZodNull,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRecord,
  ZodString,
  ZodTypeAny,
  ZodUnion,
  type z,
} from 'zod'

export interface JsonOutputSchema<TSchema extends ZodTypeAny = ZodTypeAny> {
  readonly name: string
  readonly schema: TSchema
  readonly definitions: Readonly<Record<string, ZodTypeAny>>
}

export type InferJsonOutputSchema<TOutputSchema extends JsonOutputSchema> = z.infer<TOutputSchema['schema']>

interface DefineJsonOutputSchemaOptions<TSchema extends ZodTypeAny> {
  name: string
  schema: TSchema
  definitions?: Readonly<Record<string, ZodTypeAny>>
}

/**
 * Defines the runtime schema and named types for a command's JSON output.
 *
 * @param options - The root schema name, schema, and any named nested schemas.
 * @returns Command metadata that can also be used to infer and validate the output type.
 */
export function defineJsonOutputSchema<TSchema extends ZodTypeAny>(
  options: DefineJsonOutputSchemaOptions<TSchema>,
): JsonOutputSchema<TSchema> {
  const {name, schema, definitions = {}} = options
  return {name, schema, definitions}
}

/**
 * Renders a command JSON output schema as TypeScript interfaces for help text.
 *
 * @param outputSchema - The command's JSON output schema metadata.
 * @returns TypeScript interfaces describing the command's JSON output.
 */
export function renderJsonOutputSchema(outputSchema: JsonOutputSchema): string {
  const namedSchemas = new Map<ZodTypeAny, string>([
    [outputSchema.schema, outputSchema.name],
    ...Object.entries(outputSchema.definitions).map(([name, schema]) => [schema, name] as const),
  ])

  return [
    renderInterface(outputSchema.name, outputSchema.schema, namedSchemas),
    ...Object.entries(outputSchema.definitions).map(([name, schema]) => renderInterface(name, schema, namedSchemas)),
  ].join('\n\n')
}

function renderInterface(name: string, schema: ZodTypeAny, namedSchemas: ReadonlyMap<ZodTypeAny, string>): string {
  if (!(schema instanceof ZodObject)) {
    throw new TypeError(`JSON output type ${name} must be an object schema.`)
  }

  const properties = Object.entries(schema.shape).map(([propertyName, propertySchema]) => {
    const optional = propertySchema instanceof ZodOptional
    const type = renderType(propertySchema as ZodTypeAny, namedSchemas)
    return `  ${propertyName}${optional ? '?' : ''}: ${type}`
  })

  return [`interface ${name} {`, ...properties, '}'].join('\n')
}

function renderType(schema: ZodTypeAny, namedSchemas: ReadonlyMap<ZodTypeAny, string>): string {
  if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
    const type = renderType(schema.unwrap(), namedSchemas)
    return schema instanceof ZodNullable ? `${type} | null` : type
  }

  const namedType = namedSchemas.get(schema)
  if (namedType) return namedType

  if (schema instanceof ZodString) return 'string'
  if (schema instanceof ZodNumber) return 'number'
  if (schema instanceof ZodBoolean) return 'boolean'
  if (schema instanceof ZodNull) return 'null'
  if (schema instanceof ZodLiteral) return JSON.stringify(schema.value)
  if (schema instanceof ZodEnum) return schema.options.map((value: string) => JSON.stringify(value)).join(' | ')
  if (schema instanceof ZodArray) return `${renderArrayElementType(schema.element, namedSchemas)}[]`
  if (schema instanceof ZodRecord) return `Record<string, ${renderType(schema.valueSchema, namedSchemas)}>`
  if (schema instanceof ZodUnion) {
    return schema.options.map((option: ZodTypeAny) => renderType(option, namedSchemas)).join(' | ')
  }

  if (schema instanceof ZodObject) {
    throw new TypeError('Nested JSON output object schemas must be included in definitions.')
  }

  throw new TypeError(`Unsupported JSON output schema type: ${schema.constructor.name}.`)
}

function renderArrayElementType(schema: ZodTypeAny, namedSchemas: ReadonlyMap<ZodTypeAny, string>): string {
  const type = renderType(schema, namedSchemas)
  return schema instanceof ZodUnion || schema instanceof ZodNullable ? `(${type})` : type
}
