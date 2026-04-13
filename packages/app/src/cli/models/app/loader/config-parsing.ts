import {parseStructuredErrors} from '../error-parsing.js'
import {ExtensionSpecification} from '../../extensions/specification.js'
import {TomlFile, TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'
import {zod} from '@shopify/cli-kit/node/schema'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

export interface ConfigurationError {
  file: string
  message: string
  path?: (string | number)[]
  code?: string
}

export function formatConfigurationError(error: ConfigurationError): string {
  if (error.path?.length) {
    return `[${error.path.join('.')}]: ${error.message}`
  }
  return error.message
}

export type ConfigurationResult<T> = {data: T; errors?: never} | {data?: never; errors: ConfigurationError[]}

/**
 * Loads a configuration file, validates it against a schema, and returns a result.
 */
export async function parseConfigurationFile<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  preloadedContent?: JsonMapType,
): Promise<ConfigurationResult<zod.TypeOf<TSchema>>> {
  let content = preloadedContent
  if (!content) {
    try {
      const file = await TomlFile.read(filepath)
      content = file.content
    } catch (err) {
      if (err instanceof TomlFileError) {
        return {errors: [{file: filepath, message: err.message}]}
      }
      throw err
    }
  }
  return parseConfigurationObject(schema, filepath, content)
}

/**
 * Parses a configuration object using a schema, and returns a result.
 */
export function parseConfigurationObject<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  configurationObject: unknown,
): ConfigurationResult<zod.TypeOf<TSchema>> {
  const parseResult = schema.safeParse(configurationObject)
  if (!parseResult.success) {
    return {
      errors: parseStructuredErrors(parseResult.error.issues).map((issue) => ({
        file: filepath,
        message: issue.message,
        path: issue.path,
        code: issue.code,
      })),
    }
  }
  return {data: parseResult.data}
}

/**
 * Parses a configuration object using a specification's schema, and returns a result.
 */
export function parseConfigurationObjectAgainstSpecification<TSchema extends zod.ZodType>(
  spec: ExtensionSpecification,
  filepath: string,
  configurationObject: object,
): ConfigurationResult<zod.TypeOf<TSchema>> {
  const parsed = spec.parseConfigurationObject(configurationObject)
  switch (parsed.state) {
    case 'ok': {
      return {data: parsed.data}
    }
    case 'error': {
      return {
        errors: parsed.errors.map((err) => ({
          file: filepath,
          message: err.message ?? 'Unknown error',
          path: err.path,
        })),
      }
    }
  }
}

export class AppErrors {
  private readonly errors: ConfigurationError[] = []

  addError(error: ConfigurationError): void {
    this.errors.push(error)
  }

  addErrors(errors: ConfigurationError[]): void {
    this.errors.push(...errors)
  }

  getErrors(file?: string): ConfigurationError[] {
    if (file) return this.errors.filter((err) => err.file === file)
    return [...this.errors]
  }

  isEmpty(): boolean {
    return this.errors.length === 0
  }
}
