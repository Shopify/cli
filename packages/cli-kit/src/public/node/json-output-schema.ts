import {
  ZodAny,
  ZodArray,
  ZodBoolean,
  ZodDiscriminatedUnion,
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
  ZodUnknown,
  type ZodRawShape,
  type z,
} from 'zod'

interface JsonOutputSchemaDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
  readonly name: string
  readonly schema: TSchema
  readonly definitions: Readonly<Record<string, ZodTypeAny>>
}

export interface JsonOutputSchema<TSchema extends ZodTypeAny = ZodTypeAny> extends JsonOutputSchemaDefinition<TSchema> {
  readonly typescript: string
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
 * Defines the runtime validator, encoder, and documented TypeScript type for a command's JSON output.
 *
 * @param options - The root type name, its Zod schema, and any named nested schemas.
 * @returns The complete JSON output contract.
 */
export function defineJsonOutputSchema<TSchema extends ZodTypeAny>(
  options: DefineJsonOutputSchemaOptions<TSchema>,
): JsonOutputSchema<TSchema> {
  const definition = {
    name: options.name,
    schema: options.schema,
    definitions: options.definitions ?? {},
  }

  return {
    ...definition,
    typescript: renderJsonOutputSchema(definition),
    validate: (value) => definition.schema.parse(value),
    encode: (value) => encodeJsonOutput(definition.schema.parse(value)),
  }
}

/**
 * Renders the named schemas in a JSON output contract as TypeScript declarations.
 *
 * @param outputSchema - The root schema and its named nested schemas.
 * @returns TypeScript declarations suitable for command help.
 */
export function renderJsonOutputSchema(outputSchema: JsonOutputSchemaDefinition): string {
  const namedSchemas = buildNamedSchemas(outputSchema)

  return [
    renderDeclaration(outputSchema.name, outputSchema.schema, namedSchemas),
    ...Object.entries(outputSchema.definitions).map(([name, schema]) => renderDeclaration(name, schema, namedSchemas)),
  ].join('\n\n')
}

function buildNamedSchemas(outputSchema: JsonOutputSchemaDefinition): ReadonlyMap<ZodTypeAny, string> {
  const namedSchemas = new Map<ZodTypeAny, string>()

  const definitions: [string, ZodTypeAny][] = [
    [outputSchema.name, outputSchema.schema],
    ...Object.entries(outputSchema.definitions),
  ]

  for (const [name, schema] of definitions) {
    assertTypeScriptIdentifier(name)
    const existingName = namedSchemas.get(schema)
    if (existingName) {
      throw new TypeError(`JSON output schema ${name} is already named ${existingName}.`)
    }
    namedSchemas.set(schema, name)
  }

  return namedSchemas
}

function renderDeclaration(name: string, schema: ZodTypeAny, namedSchemas: ReadonlyMap<ZodTypeAny, string>): string {
  if (schema instanceof ZodObject) return renderInterface(name, schema, namedSchemas)
  return `type ${name} = ${renderType(schema, namedSchemas, schema)}`
}

function renderInterface(
  name: string,
  schema: ZodObject<ZodRawShape>,
  namedSchemas: ReadonlyMap<ZodTypeAny, string>,
): string {
  const properties = Object.entries(schema.shape).map(([propertyName, propertySchema]) => {
    const optional = propertySchema instanceof ZodOptional
    const type = renderType(propertySchema, namedSchemas)
    return `  ${renderPropertyName(propertyName)}${optional ? '?' : ''}: ${type}`
  })

  if (schema._def.unknownKeys === 'passthrough') properties.push('  [key: string]: unknown')

  return [`interface ${name} {`, ...properties, '}'].join('\n')
}

function renderType(
  schema: ZodTypeAny,
  namedSchemas: ReadonlyMap<ZodTypeAny, string>,
  declarationSchema?: ZodTypeAny,
): string {
  if (schema instanceof ZodOptional) return renderType(schema.unwrap(), namedSchemas)
  if (schema instanceof ZodNullable) return `${renderType(schema.unwrap(), namedSchemas)} | null`

  if (schema !== declarationSchema) {
    const namedType = namedSchemas.get(schema)
    if (namedType) return namedType
  }

  if (schema instanceof ZodString) return 'string'
  if (schema instanceof ZodNumber) return 'number'
  if (schema instanceof ZodBoolean) return 'boolean'
  if (schema instanceof ZodNull) return 'null'
  if (schema instanceof ZodUnknown || schema instanceof ZodAny) return 'unknown'
  if (schema instanceof ZodLiteral) return renderLiteral(schema.value)
  if (schema instanceof ZodEnum) return schema.options.map((value: string) => JSON.stringify(value)).join(' | ')
  if (schema instanceof ZodArray) return `${renderArrayElementType(schema.element, namedSchemas)}[]`
  if (schema instanceof ZodRecord) return `Record<string, ${renderType(schema.valueSchema, namedSchemas)}>`
  if (schema instanceof ZodUnion || schema instanceof ZodDiscriminatedUnion) {
    return schema.options.map((option: ZodTypeAny) => renderType(option, namedSchemas)).join(' | ')
  }

  if (schema instanceof ZodObject) {
    throw new TypeError('Nested JSON output object schemas must be included in definitions.')
  }

  throw new TypeError(`Unsupported JSON output schema type: ${schema.constructor.name}.`)
}

function renderArrayElementType(schema: ZodTypeAny, namedSchemas: ReadonlyMap<ZodTypeAny, string>): string {
  const type = renderType(schema, namedSchemas)
  return schema instanceof ZodUnion || schema instanceof ZodDiscriminatedUnion || schema instanceof ZodNullable
    ? `(${type})`
    : type
}

function renderLiteral(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return encodeJsonOutput(value)
  }
  throw new TypeError(`Unsupported JSON output literal: ${String(value)}.`)
}

function encodeJsonOutput(value: unknown): string {
  const encoded = JSON.stringify(value, null, 2)
  if (encoded === undefined) throw new TypeError('JSON output must be serializable.')
  return encoded
}

function renderPropertyName(name: string): string {
  return isTypeScriptIdentifier(name) ? name : JSON.stringify(name)
}

function assertTypeScriptIdentifier(name: string): void {
  if (!isTypeScriptIdentifier(name)) throw new TypeError(`Invalid JSON output type name: ${name}.`)
}

function isTypeScriptIdentifier(value: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/.test(value)
}
