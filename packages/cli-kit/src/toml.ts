import * as toml from '@iarna/toml'

export function decode(input: string): object {
  return toml.parse(input)
}

export function encode(content: any): string {
  return toml.stringify(content)
}
