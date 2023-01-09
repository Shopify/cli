import * as toml from '@iarna/toml'

export function decodeToml(input: string): object {
  return toml.parse(input)
}

export function encodeToml(content: toml.JsonMap): string {
  return toml.stringify(content)
}
