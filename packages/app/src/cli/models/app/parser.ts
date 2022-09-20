import {file, schema, string, toml} from '@shopify/cli-kit'
import {err, ok, Result} from '@shopify/cli-kit/common/result'

interface ParseError {
  type: 'file_not_found' | 'decode_error' | 'invalid_schema' | 'unknown'
  message: string
}

async function loadFile(
  filepath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decode: (input: any) => any = toml.decode,
): Promise<Result<unknown, ParseError>> {
  if (!(await file.exists(filepath))) {
    return err({type: 'file_not_found', message: filepath})
  }
  const configurationContent = await file.read(filepath)
  let configuration: object
  try {
    configuration = decode(configurationContent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-catch-all/no-catch-all
  } catch (err: any) {
    // TOML errors have line, pos and col properties
    const message = (err.message as string) ?? ''
    if (err.line && err.pos && err.col) {
      return err({type: 'decode_error', message})
    } else {
      return err({type: 'unknown', message})
    }
  }
  // Convert snake_case keys to camelCase before returning
  return ok({
    ...Object.fromEntries(Object.entries(configuration).map((kv) => [string.camelize(kv[0]), kv[1]])),
  })
}

export async function parseFile<TSchema extends schema.define.ZodType>(
  schema: TSchema,
  filepath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decode: (input: any) => any = toml.decode,
): Promise<Result<schema.define.TypeOf<TSchema>, ParseError>> {
  const configurationObject = await loadFile(filepath, decode)
  if (configurationObject.isErr()) return configurationObject

  const parseResult = schema.safeParse(configurationObject.value)

  if (!parseResult.success) {
    const formattedError = JSON.stringify(parseResult.error.issues, null, 2)
    return err({type: 'invalid_schema', message: formattedError})
  }
  return ok(parseResult.data)
}
