import {normaliseJsonSchema, jsonSchemaValidate} from '../../public/node/json-schema.js'
import {JsonMapType} from '../../public/node/toml/codec.js'
import type {ZodType} from 'zod'

export interface ValidationError {
  path: string[]
  message: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonSchemaProperties = Record<string, any>

/**
 * A contract validates module config.
 *
 * From the outside, it's always `validate(config) → errors[]`.
 * How it validates internally — JSON Schema, Zod, with or without
 * a transform step — is an implementation detail.
 */
export class Contract {
  /**
   * Golden path: JSON Schema from the platform.
   * Validates directly — file shape = server shape.
   */
  static async fromJsonSchema(raw: string): Promise<Contract> {
    const schema = await normaliseJsonSchema(raw)
    return new Contract({
      validate: (input) => {
        const result = jsonSchemaValidate(structuredClone(input), schema, 'fail')
        if (result.state === 'ok') return []
        return (result.errors ?? []).map((err) => ({
          path: (err.path ?? []).map(String),
          message: err.message ?? 'Validation error',
        }))
      },
      properties: (schema.properties ?? {}) as JsonSchemaProperties,
      required: (schema.required ?? []) as string[],
    })
  }

  /**
   * Transitional: adapter wrapping a sync transform + Zod schema.
   *
   * Accepts file-shape config. Internally transforms to server shape,
   * then validates the server shape. The transform is contained — nothing leaks.
   *
   * The transform MUST be synchronous. Specs with async transforms
   * (e.g., function reads files from disk) should use `fromLocalSchema` instead.
   */
  static withAdapter(options: {schema: ZodType; transform: (config: JsonMapType) => JsonMapType}): Contract {
    return new Contract({
      validate: (fileConfig) => {
        const serverShape = options.transform(structuredClone(fileConfig))
        const result = options.schema.safeParse(serverShape)
        if (result.success) return []
        return result.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        }))
      },
      properties: {},
      required: [],
    })
  }

  /**
   * Transitional: local Zod schema without transform.
   *
   * Validates file-shape config directly against the Zod schema.
   * Used for specs with async transforms that can't use `withAdapter`.
   */
  static fromLocalSchema(schema: ZodType): Contract {
    return new Contract({
      validate: (config) => {
        const result = schema.safeParse(config)
        if (result.success) return []
        return result.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        }))
      },
      properties: {},
      required: [],
    })
  }

  /**
   * Compose: run multiple validations, collect all errors.
   *
   * Useful during transition when both a local schema and a platform
   * contract exist for the same module.
   */
  static compose(...contracts: Contract[]): Contract {
    return new Contract({
      validate: (input) => contracts.flatMap((ct) => ct.validate(input)),
      properties: Object.assign({}, ...contracts.map((ct) => ct.properties)),
      required: [...new Set(contracts.flatMap((ct) => ct.required))],
    })
  }

  private readonly validateFn: (input: JsonMapType) => ValidationError[]
  private readonly _properties: JsonSchemaProperties
  private readonly _required: string[]

  private constructor(options: {
    validate: (input: JsonMapType) => ValidationError[]
    properties: JsonSchemaProperties
    required: string[]
  }) {
    this.validateFn = options.validate
    this._properties = options.properties
    this._required = options.required
  }

  validate(input: JsonMapType): ValidationError[] {
    return this.validateFn(input)
  }

  get properties(): JsonSchemaProperties {
    return this._properties
  }

  get required(): string[] {
    return this._required
  }
}
